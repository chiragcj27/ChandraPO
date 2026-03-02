/**
 * Get the API base URL.
 *
 * We always go through the Next.js API proxy route `/api/backend`,
 * which runs server-side (on Vercel or locally) and forwards requests
 * to the actual backend server.
 */
export function getApiUrl(): string {
  // Always call our proxy route; it is same-origin and works in both
  // local development and production on Vercel.
  return "/api/backend";
}

/**
 * Helper to construct full API endpoint URLs
 */
export function getApiEndpoint(endpoint: string): string {
  const baseUrl = getApiUrl();
  // Ensure endpoint starts with /
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
}

/**
 * Get auth token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

/**
 * Create fetch options with auth token
 */
export function createAuthenticatedFetchOptions(options: RequestInit = {}): RequestInit {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  return {
    ...options,
    headers,
  };
}

/**
 * Fetch with authentication
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = getApiEndpoint(endpoint);
  const authOptions = createAuthenticatedFetchOptions(options);
  return fetch(url, authOptions);
}

