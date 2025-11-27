export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get("ip");

  if (!ip) {
    return Response.json(
      { error: "Parâmetro 'ip' é obrigatório." },
      { status: 400 }
    );
  }

  try {
    const resp = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      { cache: "no-store" }
    );

    const data = await resp.json();

    if (!resp.ok || data.error) {
      return Response.json(
        { error: "Não foi possível obter informações para este IP." },
        { status: 502 }
      );
    }

    const country = data.country_name || null;
    const region = data.region || null;
    const city = data.city || null;
    const isp = data.org || data.org_name || data.asn || null;
    const countryCode = data.country || null;

    return Response.json(
      {
        ok: true,
        country,
        region,
        city,
        isp,
        countryCode,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    return Response.json(
      { error: "Erro ao consultar serviço de geolocalização." },
      { status: 500 }
    );
  }
}

