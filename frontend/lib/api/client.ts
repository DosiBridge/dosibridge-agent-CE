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

// Token management - use secure storage utility
import {
  getAuthToken as getStoredToken,
  setAuthToken as setStoredToken,
  removeAuthToken as removeStoredToken,
  migrateExistingToken,
} from "../storage/authStorage";

// Migrate existing tokens on module load
if (typeof window !== "undefined") {
  migrateExistingToken();
}

export function getAuthToken(): string | null {
  return getStoredToken();
}

export function setAuthToken(token: string, isSuperadmin: boolean = false, persistent: boolean = false): void {
  setStoredToken(token, isSuperadmin, persistent);
}

export function removeAuthToken(): void {
  removeStoredToken();
}

/**
 * Helper function to get auth headers
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;

    // Check for active impersonation
    // We import dynamically or use global hook to avoid circular dependency
    try {
      const { useStore } = require('../store');
      const impersonatedId = useStore.getState().impersonatedUserId;
      if (impersonatedId) {
        headers['X-Impersonate-User'] = impersonatedId;
      }
    } catch (e) {
      // Store might not be initialized or accessible
    }
  }
  return headers;
}

/**
 * Helper function to handle API errors
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Try to parse error response first to get the actual error message
    let errorDetail: string;
    try {
      const errorData = await response.json();
      // FastAPI returns errors in 'detail' field
      errorDetail =
        errorData.detail || errorData.message || response.statusText;
    } catch (parseError) {
      // If JSON parsing fails, use status text
      errorDetail = response.statusText || `HTTP ${response.status}`;
    }

    // Handle 401 Unauthorized - but only remove token if we have one
    // (login/register attempts will also return 401, but shouldn't remove token)
    if (response.status === 401) {
      const token = getAuthToken();
      // Only remove token if we have one (means it's an expired/invalid token, not a login failure)
      if (token) {
        removeAuthToken();
      }
    }

    // Use the backend error detail if available, otherwise use generic messages
    const errorMessages: Record<number, string> = {
      400: errorDetail || "Invalid request. Please check your input.",
      401: errorDetail || "Incorrect email or password. Please try again.",
      403: errorDetail || "You don't have permission to perform this action.",
      404: errorDetail || "The requested resource was not found.",
      409:
        errorDetail || "A conflict occurred. The resource may already exist.",
      422: errorDetail || "Validation error. Please check your input.",
      429:
        errorDetail || "Too many requests. Please wait a moment and try again.",
      500: errorDetail || "Server error. Please try again later.",
      502:
        errorDetail ||
        "Service temporarily unavailable. Please try again later.",
      503: errorDetail || "Service unavailable. Please try again later.",
    };

    const message = errorMessages[response.status] || errorDetail;
    
    // Create error object with detail
    const error = new Error(message) as Error & {
      statusCode: number;
      detail?: string;
      isPermissionError?: boolean;
      isInactiveAccount?: boolean;
    };
    error.statusCode = response.status;
    error.detail = errorDetail;
    
    // Check if this is an inactive account error
    const isInactiveAccount = response.status === 403 && 
      (errorDetail.includes("User account is inactive") || 
       errorDetail.includes("account is inactive") ||
       errorDetail.toLowerCase().includes("inactive"));
    
    if (isInactiveAccount) {
      error.isInactiveAccount = true;
      // Update store to mark account as inactive
      try {
        const { useStore } = require('../store');
        const store = useStore.getState();
        if (store.user) {
          store.user.is_active = false;
          useStore.setState({ user: store.user });
        }
      } catch (e) {
        // Store might not be initialized
      }
    }
    
    // Mark permission errors (403 Forbidden or Superadmin access required)
    if (response.status === 403 || errorDetail.includes("Superadmin") || errorDetail.includes("access")) {
      error.isPermissionError = true;
    }
    
    throw error;
  }
  return response.json();
}
