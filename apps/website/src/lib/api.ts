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

