"use client";

import { useEffect, useMemo, useState } from "react";

function formatMs(ms) {
  if (ms == null) return "-";
  return `${ms.toFixed(0)} ms`;
}

export default function WifiCheckPage() {
  const [httpsInfo, setHttpsInfo] = useState({
    secure: null,
    details: "",
  });
  const [publicIp, setPublicIp] = useState(null);
  const [stunError, setStunError] = useState(null);
  const [latencySamples, setLatencySamples] = useState([]);
  const [latencyRunning, setLatencyRunning] = useState(false);
  const [headersInfo, setHeadersInfo] = useState(null);
  const [proxyInfo, setProxyInfo] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(null);

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

  async function detectPublicIpViaStun() {
    if (typeof window === "undefined") return;
    setStunError(null);
    setPublicIp(null);

    const RTCPeer =
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection;

    if (!RTCPeer) {
      setStunError("WebRTC não suportado neste navegador.");
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
        resolve();
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) {
          finish();
          return;
        }

        const candidate = event.candidate.candidate;
        const parts = candidate.split(" ");
        const [ip, , type] = [parts[4], parts[5], parts[7]];

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
      const response = await fetch("/api/check-headers", {
        cache: "no-store",
      });
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

  async function runAllTests() {
    setLoadingAll(true);
    setScoreResult(null);

    checkHttps();
    await detectPublicIpViaStun();
    await runLatencyTest();
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

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="wifi-card space-y-6">
        <header className="flex flex-col gap-2 border-b border-slate-700/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              Diagnóstico rápido da sua conexão
            </h1>
            <p className="text-sm text-slate-300">
              Verifica HTTPS, IP público aproximado, latência e presença de
              proxies na rota.
            </p>
          </div>

          <button
            type="button"
            onClick={runAllTests}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:bg-sky-400 sm:mt-0"
          >
            {loadingAll ? "Executando testes..." : "Executar testes"}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">HTTPS / MITM básico</h2>
              {httpsInfo.secure === true && (
                <span className="wifi-chip wifi-badge-ok">HTTPS ativo</span>
              )}
              {httpsInfo.secure === false && (
                <span className="wifi-chip wifi-badge-bad">Risco</span>
              )}
            </div>
            <p className="text-sm text-slate-200">{httpsInfo.details}</p>
            <p className="text-xs text-slate-500">
              Navegadores não expõem o certificado diretamente via JavaScript, então
              este teste é apenas heurístico.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">IP público (STUN)</h2>
              {publicIp && (
                <span className="wifi-chip wifi-badge-ok">
                  IP detectado via WebRTC
                </span>
              )}
              {!publicIp && stunError && (
                <span className="wifi-chip wifi-badge-warn">Indisponível</span>
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
          </section>

          <section className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="wifi-section-title">Latência até o servidor</h2>
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
                Nenhum teste de latência ainda. Use o botão &quot;Executar
                testes&quot;.
              </p>
            )}
            {latencySamples.length > 0 && (
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
              <h2 className="wifi-section-title">Proxies / headers</h2>
              {proxyInfo?.detected && (
                <span className="wifi-chip wifi-badge-warn">Proxy na rota</span>
              )}
              {proxyInfo && !proxyInfo.detected && (
                <span className="wifi-chip wifi-badge-ok">Nenhum proxy óbvio</span>
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
                    Foram encontrados headers típicos de proxy ou balanceador,
                    como <code>X-Forwarded-*</code> ou <code>Via</code>. Isso é
                    comum em CDNs/provedores, mas também pode indicar proxies
                    intermediários.
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

        <section className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
          <h2 className="wifi-section-title mb-2">Score de segurança</h2>

          {!scoreResult && (
            <p className="text-sm text-slate-200">
              Após rodar os testes, um score heurístico de 0 a 100 será exibido
              aqui, combinando HTTPS, proxies e latência.
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

        <footer className="border-t border-slate-800 pt-3 text-center text-xs text-slate-500">
          {lastRunAt && (
            <p className="mb-1">
              Última execução:{" "}
              {lastRunAt.toLocaleString("pt-BR", {
                hour12: false,
              })}
            </p>
          )}
          <p>
            Este painel fornece apenas indícios de segurança da rota. Não
            substitui ferramentas profissionais de análise de tráfego.
          </p>
        </footer>
      </section>
    </main>
  );
}

