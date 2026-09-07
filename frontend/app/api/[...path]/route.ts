import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = req.headers.get("origin");
  if (origin && !["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
    return Response.json({ detail: "Local workspace only." }, { status: 403 });
  const { path } = await params;
  const base = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  try {
    const response = await fetch(
      `${base}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`,
      {
        method: req.method,
        headers: {
          ...(req.headers.get("content-type")
            ? { "Content-Type": req.headers.get("content-type")! }
            : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : await req.arrayBuffer(),
        cache: "no-store",
        signal: AbortSignal.timeout(190000),
      },
    );
    const headers = new Headers({
      "Content-Type":
        response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    for (const key of ["content-disposition", "x-content-type-options"])
      if (response.headers.get(key))
        headers.set(key, response.headers.get(key)!);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json(
      {
        detail:
          "Backend is unavailable. Start FastAPI and PostgreSQL, then retry. No mock fallback was used.",
      },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT };
