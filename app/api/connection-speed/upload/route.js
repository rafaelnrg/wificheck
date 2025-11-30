export const runtime = "nodejs";

export async function POST(request) {
  try {
    const buffer = await request.arrayBuffer();
    const bytes = buffer.byteLength;

    return new Response(
      JSON.stringify({ receivedBytes: bytes }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Falha ao processar upload" }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      }
    );
  }
}

