/**
 * Base API client utilities
 * Handles configuration, authentication, and error handling
 */

// Runtime config loader - reads from public/runtime-config.json if available
// This allows the API URL to be configured at container startup time
let runtimeConfig: { API_BASE_URL?: string } | null = null;
let configLoadPromise: Promise<string> | null = null;

/**
 * Get API base URL - loads runtime config on first call, then caches it
 */
export async function getApiBaseUrl(): Promise<string> {
  // Return cached value if already loaded
  if (runtimeConfig?.API_BASE_URL) {
    return runtimeConfig.API_BASE_URL;
  }

  // If already loading, return the same promise
  if (configLoadPromise) {
    return configLoadPromise;
  }

  // Start loading config
  configLoadPromise = (async () => {
    try {
      // Try to fetch runtime config from API route (more reliable than static file)
      const response = await fetch("/api/runtime-config", {
        cache: "no-store", // Always fetch fresh config
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (response.ok) {
        runtimeConfig = await response.json();
        if (runtimeConfig?.API_BASE_URL) {
          console.log("✓ Runtime config loaded:", runtimeConfig.API_BASE_URL);
          return runtimeConfig.API_BASE_URL;
        } else {
          console.warn("⚠️ Runtime config loaded but API_BASE_URL is missing");
        }
      } else {
        console.warn(
          `⚠️ Failed to load runtime config: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("⚠️ Error loading runtime config:", error);
      // Don't silently fail - log the error
    }

    // Fall back to build-time env var or default
    // In production, prefer the environment variable over localhost
    const fallbackUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `https://${window.location.hostname.replace("agent.", "agentapi.")}`
        : "http://localhost:8085");

    console.log("Using API base URL:", fallbackUrl);
    return fallbackUrl;
  })();

  return configLoadPromise;
}

// Token management
const TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Helper function to get auth headers
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Helper function to handle API errors
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      removeAuthToken();
      // Redirect to login will be handled by the auth guard
      throw new Error("Unauthorized - Please login again");
    }

    // Try to parse error response
    let errorDetail: string;
    try {
      const error = await response.json();
      errorDetail = error.detail || error.message || response.statusText;
    } catch {
      errorDetail = response.statusText || `HTTP ${response.status}`;
    }

    // Create more descriptive error messages
    const errorMessages: Record<number, string> = {
      400: "Invalid request. Please check your input.",
      401: "Authentication required. Please log in.",
      403: "You don't have permission to perform this action.",
      404: "The requested resource was not found.",
      409: "A conflict occurred. The resource may already exist.",
      422: "Validation error. Please check your input.",
      429: "Too many requests. Please wait a moment and try again.",
      500: "Server error. Please try again later.",
      502: "Service temporarily unavailable. Please try again later.",
      503: "Service unavailable. Please try again later.",
    };

    const message = errorMessages[response.status] || errorDetail;
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = response.status;
    throw error;
  }
  return response.json();
}
