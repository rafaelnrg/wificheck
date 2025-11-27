export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const headers = {};

  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return Response.json(
    {
      ok: true,
      headers,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

