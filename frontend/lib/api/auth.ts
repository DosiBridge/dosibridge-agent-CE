/**
 * Authentication API client
 */

import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from "@/types/api";
import {
  getApiBaseUrl,
  getAuthHeaders,
  handleResponse,
  removeAuthToken,
  setAuthToken,
} from "./client";

export async function register(
  data: RegisterRequest,
  persistentAccess: boolean = false
): Promise<AuthResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<AuthResponse>(response);
  
  // Determine if user is superadmin
  const isSuperadmin = result.user?.role === "superadmin";
  
  // Store token with appropriate persistence
  setAuthToken(result.access_token, isSuperadmin, persistentAccess && isSuperadmin);
  return result;
}

export async function login(
  data: LoginRequest,
  persistentAccess: boolean = false
): Promise<AuthResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<AuthResponse>(response);
  
  // Determine if user is superadmin
  const isSuperadmin = result.user?.role === "superadmin";
  
  // Store token with appropriate persistence
  // Only superadmin can use persistent access
  setAuthToken(result.access_token, isSuperadmin, persistentAccess && isSuperadmin);
  return result;
}

export async function logout(): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch (error) {
    // Ignore errors on logout
    console.error("Logout error:", error);
  } finally {
    removeAuthToken();
  }
}

/**
 * Get current user - returns user if authenticated, throws error if not
 * Note: 401 errors are expected when not authenticated and are handled silently
 */
export async function getCurrentUser(): Promise<User> {
  const apiBaseUrl = await getApiBaseUrl();
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      // For 401, this is expected when not authenticated - throw a specific error
      // Don't call handleResponse as it will remove the token unnecessarily
      if (response.status === 401) {
        const error = new Error("Not authenticated") as Error & {
          statusCode: number;
          isUnauthenticated: boolean;
        };
        error.statusCode = 401;
        error.isUnauthenticated = true;
        throw error;
      }
      // For other errors, use handleResponse
      return handleResponse<User>(response);
    }
    return response.json();
  } catch (error) {
    // If fetch fails (network error, etc.), treat as not authenticated
    if (error instanceof Error && error.name !== "AbortError") {
      // Re-throw if it's already our custom error
      if ((error as any).isUnauthenticated) {
        throw error;
      }
      const authError = new Error("Not authenticated") as Error & {
        statusCode: number;
        isUnauthenticated: boolean;
      };
      authError.statusCode = 401;
      authError.isUnauthenticated = true;
      throw authError;
    }
    throw error;
  }
}
