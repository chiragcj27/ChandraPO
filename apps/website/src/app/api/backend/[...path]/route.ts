const BACKEND_BASE_URL = process.env.BACKEND_API_URL || "http://localhost:4000";

async function proxy(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  const pathSegments = params.path ?? [];
  const path = pathSegments.join("/");

  const incomingUrl = new URL(request.url);
  const search = incomingUrl.search || "";

  const targetUrl = `${BACKEND_BASE_URL}/${path}${search}`;

  const headers = new Headers(request.headers);
  // Do not forward the host header from the original request
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    // Forward the request body for non-GET/HEAD methods
    init.body = request.body as any;
    (init as any).duplex = "half";
  }

  const backendResponse = await fetch(targetUrl, init);

  const responseHeaders = new Headers(backendResponse.headers);

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH, proxy as OPTIONS };

