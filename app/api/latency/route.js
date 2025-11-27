export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();

  return Response.json(
    {
      serverTime: now,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

