export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function computeScore(payload) {
  let score = 100;
  const issues = [];

  if (!payload.httpsSecure) {
    score -= 40;
    issues.push(
      "A página não está em HTTPS ou o contexto não é considerado totalmente seguro."
    );
  }

  const samples = Array.isArray(payload.latencySamples)
    ? payload.latencySamples
    : [];
  let avgLatency = null;
  if (samples.length > 0) {
    avgLatency =
      samples.reduce((acc, v) => acc + Number(v || 0), 0) / samples.length;

    if (avgLatency > 800) {
      score -= 20;
      issues.push(
        "Latência muito alta até o servidor, o que pode indicar rede instável ou rota congestionada."
      );
    } else if (avgLatency > 300) {
      score -= 10;
      issues.push(
        "Latência moderada até o servidor; não é crítico, mas pode impactar a experiência."
      );
    }
  }

  const proxyHeaders = payload.proxyHeaders || {};
  if (Object.keys(proxyHeaders).length > 0) {
    score -= 15;
    issues.push(
      "Foram detectados headers típicos de proxy/balanceador (X-Forwarded-*, Via ou Forwarded). Isso é comum em CDNs, mas também pode indicar proxies intermediários."
    );
  }

  const rawHeaders = payload.rawHeaders || {};
  const clientIpHeader =
    rawHeaders["x-real-ip"] || rawHeaders["x-forwarded-for"];

  if (payload.publicIp && clientIpHeader) {
    if (!String(clientIpHeader).includes(payload.publicIp)) {
      score -= 10;
      issues.push(
        "O IP visto pelo backend não coincide com o IP detectado via STUN. Podem existir NATs/CGNATs ou proxies na rota."
      );
    }
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let level = "desconhecido";
  if (score >= 80) level = "boa";
  else if (score >= 60) level = "ok";
  else if (score >= 40) level = "atenção";
  else level = "crítica";

  return {
    score,
    level,
    issues,
    details: {
      avgLatency,
      latencySamples: samples,
      proxyHeaders,
    },
  };
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const result = computeScore(payload);

  return Response.json(result, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

