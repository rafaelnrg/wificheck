export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  // Opcional: no futuro você pode persistir esses logs em algum lugar.
  const body = await request.json().catch(() => ({}));

  return Response.json(
    {
      ok: true,
      received: body,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

