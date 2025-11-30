export const runtime = "nodejs";

const DEFAULT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const defaultPayload = new Uint8Array(DEFAULT_SIZE_BYTES);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sizeParam = searchParams.get("size");

  let size = DEFAULT_SIZE_BYTES;
  if (sizeParam) {
    const parsed = Number(sizeParam);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 20 * 1024 * 1024) {
      size = parsed;
    }
  }

  const body = size === DEFAULT_SIZE_BYTES ? defaultPayload : new Uint8Array(size);

  return new Response(body, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      "content-length": String(body.byteLength),
    },
  });
}

