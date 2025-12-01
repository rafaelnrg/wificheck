"use client";

import { useEffect, useMemo, useState } from "react";

function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "-";
  return `${ms.toFixed(0)} ms`;
}

function countryCodeToFlag(code) {
  if (!code || typeof code !== "string") return "";
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2) return "";
  const codePoints = [...upper].map((char) => 127397 + char.codePointAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function WifiCheckPage() {
  const [httpsInfo, setHttpsInfo] = useState({ secure: null, details: "" });
  const [publicIp, setPublicIp] = useState(null);
  const [stunError, setStunError] = useState(null);
  const [ipInfo, setIpInfo] = useState(null);
  const [latencySamples, setLatencySamples] = useState([]);
  const [latencyRunning, setLatencyRunning] = useState(false);
  const [headersInfo, setHeadersInfo] = useState(null);
  const [proxyInfo, setProxyInfo] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [downloadMbps, setDownloadMbps] = useState(null);
  const [uploadMbps, setUploadMbps] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [showAbout, setShowAbout] = useState(false);

  const latencyStats = useMemo(() => {
    if (!latencySamples.length) {
      return { avg: null, min: null, max: null };
    }
    const min = Math.min(...latencySamples);
    const max = Math.max(...latencySamples);
    const avg =
      latencySamples.reduce((acc, v) => acc + v, 0) / latencySamples.length;
    return { min, max, avg };
  }, [latencySamples]);

  function checkHttps() {
    if (typeof window === "undefined") return;
    const protocol = window.location.protocol;
    const isSecure = protocol === "https:" && window.isSecureContext === true;

    let details = "";
    if (!isSecure) {
      if (protocol !== "https:") {
        details =
          "A página não está carregada sobre HTTPS. Isso facilita ataques de interceptação (MITM).";
      } else if (!window.isSecureContext) {
        details =
          "O navegador não considera este contexto totalmente seguro (isSecureContext = false).";
      }
    } else {
      details =
        "Conexão HTTPS ativa e contexto considerado seguro pelo navegador.";
    }

    setHttpsInfo({ secure: isSecure, details });
  }

  async function fetchGeoInfo(ip) {
    try {
      const response = await fetch(`/api/geo-ip?ip=${encodeURIComponent(ip)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data || data.error) {
        setIpInfo(null);
        return;
      }

      const locationParts = [
        data.country || null,
        data.region || null,
        data.city || null,
      ].filter(Boolean);

      setIpInfo({
        locationText: locationParts.join(", "),
        isp: data.isp || null,
        countryCode: data.countryCode || null,
      });
    } catch {
      setIpInfo(null);
    }
  }

  async function detectPublicIpViaStun() {
    if (typeof window === "undefined") return;
    setStunError(null);
    setPublicIp(null);
    setIpInfo(null);

    const RTCPeer =
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection;

    if (!RTCPeer) {
      setStunError("WebRTC não é suportado neste navegador.");
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const candidates = new Set();

    return new Promise((resolve) => {
      let resolved = false;

      function finish() {
        if (resolved) return;
        resolved = true;
        pc.close();
        const ip = candidates.size ? Array.from(candidates)[0] : null;
        if (!ip) {
          setStunError(
            "Não foi possível obter o IP público via STUN (pode estar bloqueado)."
          );
        }
        setPublicIp(ip);
        if (ip) {
          void fetchGeoInfo(ip);
        }
        resolve();
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) {
          finish();
          return;
        }

        const candidate = event.candidate.candidate;
        const parts = candidate.split(" ");
        const ip = parts[4];
        const type = parts[7];

        if (type === "srflx" && ip) {
          candidates.add(ip);
        }
      };

      pc.createDataChannel("probe");

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          setStunError("Erro ao criar oferta WebRTC.");
          finish();
        });

      setTimeout(finish, 7000);
    });
  }

  async function runLatencyTest() {
    setLatencyRunning(true);
    setLatencySamples([]);
    try {
      const samples = [];
      const attempts = 5;

      for (let i = 0; i < attempts; i += 1) {
        const start = performance.now();
        const response = await fetch(`/api/latency?i=${i}`, {
          cache: "no-store",
        });
        await response.json();
        const end = performance.now();
        samples.push(end - start);
      }

      setLatencySamples(samples);
    } catch {
      setLatencySamples([]);
    } finally {
      setLatencyRunning(false);
    }
  }

  async function fetchHeadersAndProxyInfo() {
    try {
      const response = await fetch("/api/check-headers", { cache: "no-store" });
      const data = await response.json();
      const headers = data.headers || {};

      const proxyKeys = [
        "x-forwarded-for",
        "x-forwarded-proto",
        "x-forwarded-host",
        "via",
        "forwarded",
      ];

      const proxyHeaders = {};
      proxyKeys.forEach((key) => {
        if (headers[key]) {
          proxyHeaders[key] = headers[key];
        }
      });

      setHeadersInfo({ headers });
      setProxyInfo({
        detected: Object.keys(proxyHeaders).length > 0,
        headers: proxyHeaders,
      });
    } catch {
      setHeadersInfo(null);
      setProxyInfo(null);
    }
  }

  async function runSpeedTests() {
    if (typeof window === "undefined" || typeof performance === "undefined") {
      setDownloadMbps(null);
      setUploadMbps(null);
      return;
    }

    try {
      const sizeBytes = 2 * 1024 * 1024;

      const startDown = performance.now();
      const resDown = await fetch(
        `/api/connection-speed/download?size=${sizeBytes}`,
        { cache: "no-store" }
      );
      const bufDown = await resDown.arrayBuffer();
      const endDown = performance.now();
      const secondsDown = (endDown - startDown) / 1000;

      if (secondsDown > 0 && bufDown.byteLength > 0) {
        const mbpsDown =
          (bufDown.byteLength * 8) / (secondsDown * 1024 * 1024);
        setDownloadMbps(mbpsDown);
      } else {
        setDownloadMbps(null);
      }

      const payload = new Uint8Array(sizeBytes);
      const startUp = performance.now();
      const resUp = await fetch("/api/connection-speed/upload", {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: payload,
      });
      await resUp.arrayBuffer();
      const endUp = performance.now();
      const secondsUp = (endUp - startUp) / 1000;

      if (secondsUp > 0) {
        const mbpsUp =
          (payload.byteLength * 8) / (secondsUp * 1024 * 1024);
        setUploadMbps(mbpsUp);
      } else {
        setUploadMbps(null);
      }
    } catch {
      setDownloadMbps(null);
      setUploadMbps(null);
    }
  }

  async function runAllTests() {
    setLoadingAll(true);
    setScoreResult(null);
    setDownloadMbps(null);
    setUploadMbps(null);

    checkHttps();
    await detectPublicIpViaStun();
    await runLatencyTest();
    await runSpeedTests();
    await fetchHeadersAndProxyInfo();

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          httpsSecure: httpsInfo.secure,
          publicIp,
          latencySamples,
          proxyHeaders: proxyInfo?.headers ?? {},
          rawHeaders: headersInfo?.headers ?? {},
        }),
      });

      const data = await response.json();
      setScoreResult(data);
    } catch {
      setScoreResult(null);
    } finally {
      setLoadingAll(false);
      setLastRunAt(new Date());
    }
  }

  useEffect(() => {
    checkHttps();
  }, []);

  const flagEmoji = ipInfo?.countryCode
    ? countryCodeToFlag(ipInfo.countryCode)
    : "";

  const locationText =
    ipInfo?.locationText || (publicIp ? "Localização não disponível." : null);

  return (
    <main className="min-h-screen px-4 pt-4 pb-8">
      <section className="wifi-card mx-auto space-y-6">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-sm text-slate-200">
          <h2 className="wifi-section-title mb-1">Velocidade da internet</h2>
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="text-slate-400">Ping médio</p>
              <p className="font-mono text-sky-300 text-2xl">
                {latencyStats.avg != null
                  ? `${latencyStats.avg.toFixed(0)} ms`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Download</p>
              <p className="font-mono text-emerald-300 text-2xl">
                {downloadMbps != null
                  ? `${downloadMbps.toFixed(1)} Mbps`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Upload</p>
              <p className="font-mono text-amber-300 text-2xl">
                {uploadMbps != null
                  ? `${uploadMbps.toFixed(1)} Mbps`
                  : "-"}
              </p>
            </div>
          </div>
        </div>

        <header className="flex flex-col gap-2 border-b border-slate-700/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {"Diagnóstico de segurança da sua conexão"}
            </h1>
            <p className="text-sm text-slate-300">
              {
                "Verifica HTTPS, IP público aproximado, latência e presença de proxies na rota."
              }
            </p>
          </div>

          <button
            type="button"
            onClick={runAllTests}
            className="mt-3 inline-flex h-20 w-20 items-center justify-center rounded-full bg-sky-500 text-xl font-bold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:bg-sky-400 sm:mt-0"
          >
            {loadingAll ? (
              <span className="leading-tight text-sm font-bold">
                INICIANDO
              </span>
            ) : (
              <span className="leading-tight">INICIAR</span>
            )}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">HTTPS / MITM BÁSICO</h2>
              {httpsInfo.secure === true && (
                <span className="wifi-chip wifi-badge-ok">HTTPS ativo</span>
              )}
              {httpsInfo.secure === false && (
                <span className="wifi-chip wifi-badge-bad">Risco</span>
              )}
            </div>
            <p className="text-sm text-slate-200">{httpsInfo.details}</p>
            <p className="text-xs text-slate-500">
              {
                "Navegadores não expõem o certificado diretamente via JavaScript, então este teste é apenas heurístico."
              }
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">IP PÚBLICO (STUN)</h2>
              {publicIp && (
                <span className="wifi-chip wifi-badge-ok">
                  IP detectado via WebRTC
                </span>
              )}
              {!publicIp && stunError && (
                <span className="wifi-chip wifi-badge-warn">
                  Indisponível
                </span>
              )}
            </div>

            {publicIp ? (
              <p className="wifi-mono">{publicIp}</p>
            ) : (
              <p className="text-sm text-slate-200">
                {stunError ??
                  "Execute os testes para tentar obter o IP público via STUN."}
              </p>
            )}

            {stunError && (
              <p className="text-xs text-amber-300">{stunError}</p>
            )}

            {publicIp && (
              <div className="mt-3 space-y-1 text-xs text-slate-200">
                <p>
                  <span className="font-semibold">
                    Localização do meu endereço de IP:
                  </span>{" "}
                  {flagEmoji && (
                    <span className="mr-1" aria-hidden="true">
                      {flagEmoji}
                    </span>
                  )}
                  {locationText}
                </p>
                <p>
                  <span className="font-semibold">
                    Fornecedor de serviços de internet:
                  </span>{" "}
                  {ipInfo?.isp || "Não disponível."}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">LATÊNCIA ATÉ O SERVIDOR</h2>
              {latencySamples.length > 0 && (
                <span className="wifi-chip">
                  {latencySamples.length} amostras
                </span>
              )}
            </div>

            {latencyRunning && (
              <p className="text-sm text-slate-200">
                Medindo latência... aguarde alguns segundos.
              </p>
            )}

            {!latencyRunning && latencySamples.length === 0 && (
              <p className="text-sm text-slate-200">
                Nenhum teste de latência ainda. Use o botão "Executar testes".
              </p>
            )}

            {!latencyRunning && latencySamples.length > 0 && (
              <div className="space-y-1 text-sm text-slate-200">
                <p>
                  Média:{" "}
                  <span className="font-mono">
                    {formatMs(latencyStats.avg)}
                  </span>
                </p>
                <p>
                  Mínima:{" "}
                  <span className="font-mono">
                    {formatMs(latencyStats.min)}
                  </span>
                </p>
                <p>
                  Máxima:{" "}
                  <span className="font-mono">
                    {formatMs(latencyStats.max)}
                  </span>
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">PROXIES / HEADERS</h2>
              {proxyInfo?.detected && (
                <span className="wifi-chip wifi-badge-warn">
                  Proxy na rota
                </span>
              )}
              {proxyInfo && !proxyInfo.detected && (
                <span className="wifi-chip wifi-badge-ok">
                  Nenhum proxy óbvio
                </span>
              )}
            </div>

            {!headersInfo && (
              <p className="text-sm text-slate-200">
                Headers ainda não coletados. Execute os testes para ver os
                cabeçalhos reais recebidos pelo backend.
              </p>
            )}

            {proxyInfo && (
              <div className="space-y-2">
                {proxyInfo.detected ? (
                  <p className="text-sm text-amber-200">
                    Foram encontrados headers típicos de proxy ou
                    balanceador, como <code>X-Forwarded-*</code> ou
                    <code>Via</code>. Isso é comum em CDNs/provedores, mas
                    também pode indicar proxies intermediários.
                  </p>
                ) : (
                  <p className="text-sm text-emerald-200">
                    Nenhum header típico de proxy foi encontrado.
                  </p>
                )}

                {Object.keys(proxyInfo.headers).length > 0 && (
                  <div className="space-y-1 rounded-md bg-slate-900/80 p-2">
                    {Object.entries(proxyInfo.headers).map(([key, value]) => (
                      <div key={key} className="wifi-mono">
                        <span className="text-slate-400">{key}: </span>
                        {String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <section
          className={`rounded-xl border bg-slate-900/60 p-4 ${
            scoreResult?.level
              ? (() => {
                  const level = String(scoreResult.level).toLowerCase();
                  if (level.startsWith("boa")) {
                    return "border-emerald-500/70 bg-emerald-500/5";
                  }
                  if (level.startsWith("ok")) {
                    return "border-sky-400/70 bg-sky-400/5";
                  }
                  if (level.startsWith("aten")) {
                    return "border-amber-400/70 bg-amber-400/5";
                  }
                  if (level.startsWith("cr")) {
                    return "border-rose-500/70 bg-rose-500/5";
                  }
                  return "border-slate-700/70";
                })()
              : "border-slate-700/70"
          }`}
        >
          <h2 className="wifi-section-title mb-2">SCORE DE SEGURANÇA</h2>

          {!scoreResult && (
            <p className="text-sm text-slate-200">
              {
                "Após rodar os testes, um score heurístico de 0 a 100 será exibido aqui, combinando HTTPS, proxies e latência."
              }
            </p>
          )}

          {scoreResult && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold">
                  {scoreResult.score}
                </span>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  / 100
                </span>
              </div>

              {scoreResult.level && (
                <p className="text-sm text-slate-200">
                  Nível estimado:{" "}
                  <span className="font-semibold">{scoreResult.level}</span>
                </p>
              )}

              {scoreResult.issues?.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                  {scoreResult.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <footer className="border-t border-slate-800 pt-3 text-center text-xs text-slate-500 space-y-2">
          {lastRunAt && (
            <p className="mb-1">
              Última execução:{" "}
              {lastRunAt.toLocaleString("pt-BR", { hour12: false })}
            </p>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAbout((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/80 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 shadow-sm shadow-slate-900/60 transition hover:border-sky-400/80 hover:bg-slate-900"
            >
              <span className="text-xs" aria-hidden="true">
                {"ℹ️"}
              </span>
              <span>Sobre o teste</span>
            </button>
          </div>

          {showAbout && (
            <div className="mx-auto mt-1 max-w-2xl rounded-lg border border-slate-700/70 bg-slate-900/80 p-3 text-left text-[11px] leading-relaxed">
              <p className="mb-1 font-semibold text-sky-300">
                O que é possível detectar via página web
              </p>
              <ul className="mb-2 list-disc pl-4 text-sky-200">
                <li>
                  Se a conexão está usando HTTPS real (e não um MITM com
                  certificado inválido).
                </li>
                <li>
                  Fingerprint parcial do certificado/rota, o que ajuda a
                  perceber interceptações ou proxies transparentes.
                </li>
                <li>
                  IP público aproximado do usuário, permitindo comparar com
                  redes conhecidas.
                </li>
                <li>
                  Latência e comportamento da rota usando chamadas HTTP e
                  STUN/WebRTC.
                </li>
                <li>
                  Presença de proxies transparentes por meio da análise de
                  headers como Via e X-Forwarded-*.
                </li>
                <li>
                  Indícios de vazamento de DNS (DNS leak) com requisições para
                  domínios específicos.
                </li>
              </ul>

              <p className="mb-1 font-semibold text-amber-200">
                O que não é possível apenas pelo browser
              </p>
              <ul className="list-disc pl-4 text-amber-200">
                <li>
                  Executar traceroute real a partir do seu dispositivo.
                </li>
                <li>
                  Acessar a tabela de roteamento ou configuração de rede do
                  sistema.
                </li>
                <li>
                  Detectar diretamente se o Wi-Fi usa WPA2, WPA3 ou outro
                  protocolo.
                </li>
                <li>
                  Validar toda a superfície de ataque da rede – aqui fazemos
                  apenas inferência de risco, não uma auditoria completa.
                </li>
              </ul>
            </div>
          )}

          <p className="pt-1">
            {
              "Este painel fornece apenas indícios de segurança da rota. Não substitui ferramentas profissionais de análise de tráfego."
            }
          </p>

          <div className="mt-3">
            <hr className="border-slate-700" />
            <p className="mt-2 text-[11px] text-white">
              Powered by Rafael Freitas
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}
