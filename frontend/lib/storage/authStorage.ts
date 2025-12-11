/**
 * Secure Authentication Storage Utility
 * 
 * Provides persistent access for superadmin with proper security:
 * - Regular users: session-only tokens (cleared on browser close)
 * - Superadmin with persistent access: tokens stored in localStorage
 * - Superadmin without persistent access: tokens stored in sessionStorage
 */

const TOKEN_KEY = "auth_token";
const PERSISTENT_ACCESS_KEY = "superadmin_persistent_access";
const USER_ROLE_KEY = "user_role";

/**
 * Check if persistent access is enabled for superadmin
 */
export function isPersistentAccessEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PERSISTENT_ACCESS_KEY) === "true";
}

/**
 * Enable persistent access for superadmin
 */
export function enablePersistentAccess(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSISTENT_ACCESS_KEY, "true");
}

/**
 * Disable persistent access (use session-only)
 */
export function disablePersistentAccess(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSISTENT_ACCESS_KEY);
  // Also clear any existing persistent token
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Store user role for access control decisions
 */
export function storeUserRole(role: string): void {
  if (typeof window === "undefined") return;
  if (role === "superadmin") {
    localStorage.setItem(USER_ROLE_KEY, role);
  } else {
    sessionStorage.setItem(USER_ROLE_KEY, role);
  }
}

/**
 * Get stored user role
 */
export function getUserRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY);
}

/**
 * Clear user role
 */
export function clearUserRole(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_ROLE_KEY);
  sessionStorage.removeItem(USER_ROLE_KEY);
}

/**
 * Get authentication token from appropriate storage
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  
  // Check persistent storage first (for superadmin with persistent access)
  const persistentToken = localStorage.getItem(TOKEN_KEY);
  if (persistentToken && isPersistentAccessEnabled()) {
    return persistentToken;
  }
  
  // Check session storage (for regular users or superadmin without persistent access)
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Store authentication token in appropriate storage based on user role and preferences
 */
export function setAuthToken(token: string, isSuperadmin: boolean = false, persistent: boolean = false): void {
  if (typeof window === "undefined") return;
  
  // Clear any existing tokens first
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  
  if (isSuperadmin && persistent) {
    // Superadmin with persistent access: store in localStorage
    localStorage.setItem(TOKEN_KEY, token);
    enablePersistentAccess();
    storeUserRole("superadmin");
  } else if (isSuperadmin && !persistent) {
    // Superadmin without persistent access: store in sessionStorage
    sessionStorage.setItem(TOKEN_KEY, token);
    disablePersistentAccess();
    storeUserRole("superadmin");
  } else {
    // Regular user: always use sessionStorage (session-only)
    sessionStorage.setItem(TOKEN_KEY, token);
    disablePersistentAccess();
    storeUserRole("user");
  }
}

/**
 * Remove authentication token from all storage locations
 */
export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  clearUserRole();
}

/**
 * Check if user was previously logged in as superadmin with persistent access
 */
export function hasPersistentSuperadminSession(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem(TOKEN_KEY);
  const persistentEnabled = isPersistentAccessEnabled();
  const role = getUserRole();
  return !!(token && persistentEnabled && role === "superadmin");
}

/**
 * Migrate existing token to new storage system (for backward compatibility)
 */
export function migrateExistingToken(): void {
  if (typeof window === "undefined") return;
  
  // Check if there's an old token in localStorage
  const oldToken = localStorage.getItem(TOKEN_KEY);
  if (oldToken) {
    // Check if user is superadmin (we'll need to verify this)
    const role = getUserRole();
    const persistentEnabled = isPersistentAccessEnabled();
    
    if (role === "superadmin" && persistentEnabled) {
      // Keep it in localStorage (persistent access enabled)
      return;
    } else {
      // Move to sessionStorage (session-only)
      sessionStorage.setItem(TOKEN_KEY, oldToken);
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}


