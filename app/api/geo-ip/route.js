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
      `https://ipwho.is/${encodeURIComponent(ip)}`,
      { cache: "no-store" }
    );

    const data = await resp.json();

    if (!resp.ok || !data || data.success === false) {
      return Response.json(
        { error: "Não foi possível obter informações para este IP." },
        { status: 502 }
      );
    }

    const country = data.country || null;
    const region = data.region || null;
    const city = data.city || null;
    const isp =
      (data.connection && (data.connection.isp || data.connection.org)) || null;
    const countryCode = data.country_code || null;

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
  } catch {
    return Response.json(
      { error: "Erro ao consultar serviço de geolocalização." },
      { status: 500 }
    );
  }
}

