/**
 * Get the API base URL from environment variables.
 * Defaults to http://localhost:4000 if not set.
 */
export function getApiUrl(): string {
  // In Next.js, client-side environment variables must be prefixed with NEXT_PUBLIC_
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  // Remove trailing slash if present
  return apiUrl.replace(/\/$/, "");
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

