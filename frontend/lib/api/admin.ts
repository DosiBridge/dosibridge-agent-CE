import { getApiBaseUrl, getAuthHeaders, handleResponse } from "./client";

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  role: string;
  created_at: string;
}

export interface SystemStats {
  total_users: number;
  active_users: number;
  blocked_users: number;
  total_conversations: number;
  total_documents: number;
  total_mcp_servers: number;
}

export interface SystemUsageHistory {
  history: {
    date: string;
    requests: number;
    tokens: number;
    input_tokens: number;
    output_tokens: number;
    embedding_tokens: number;
    errors: number;
  }[];
  total_requests: number;
  days: number;
}

export const listUsers = async (): Promise<AdminUser[]> => {
  // Check if impersonating a non-admin user before making API call
  try {
    const { useStore } = require('../store');
    const impersonatedUserId = useStore.getState().impersonatedUserId;
    const user = useStore.getState().user;
    if (impersonatedUserId && user?.role !== 'superadmin') {
      // Return a rejected promise that won't log to console
      return Promise.reject({
        message: "Admin access is not available when viewing as a regular user",
        detail: "Admin access is not available when viewing as a regular user",
        isPermissionError: true,
        statusCode: 403
      });
    }
  } catch (e) {
    // Store might not be available, continue with API call
  }

  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<AdminUser[]>(response);
};

export const getUser = async (userId: number): Promise<AdminUser> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<AdminUser>(response);
};

export const blockUser = async (userId: number): Promise<AdminUser> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/block`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; user: AdminUser }>(response);
  return data.user;
};

export const unblockUser = async (userId: number): Promise<AdminUser> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/unblock`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; user: AdminUser }>(response);
  return data.user;
};

export const getSystemStats = async (): Promise<SystemStats> => {
  // Check if impersonating a non-admin user before making API call
  try {
    const { useStore } = require('../store');
    const impersonatedUserId = useStore.getState().impersonatedUserId;
    const user = useStore.getState().user;
    if (impersonatedUserId && user?.role !== 'superadmin') {
      // Return a rejected promise that won't log to console
      return Promise.reject({
        message: "Admin access is not available when viewing as a regular user",
        detail: "Admin access is not available when viewing as a regular user",
        isPermissionError: true,
        statusCode: 403
      });
    }
  } catch (e) {
    // Store might not be available, continue with API call
  }

  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/system/stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<SystemStats>(response);
};

export const getSystemUsageHistory = async (days: number = 7): Promise<SystemUsageHistory> => {
  // Check if impersonating a non-admin user before making API call
  try {
    const { useStore } = require('../store');
    const impersonatedUserId = useStore.getState().impersonatedUserId;
    const user = useStore.getState().user;
    if (impersonatedUserId && user?.role !== 'superadmin') {
      // Return a rejected promise that won't log to console
      return Promise.reject({
        message: "Admin access is not available when viewing as a regular user",
        detail: "Admin access is not available when viewing as a regular user",
        isPermissionError: true,
        statusCode: 403
      });
    }
  } catch (e) {
    // Store might not be available, continue with API call
  }

  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/system/usage-history?days=${days}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<SystemUsageHistory>(response);
};

// --- Global Config ---

export const createGlobalLLMConfig = async (config: {
  type: string;
  model: string;
  api_key?: string;
  base_url?: string;
  is_default?: boolean;
}): Promise<{ status: string; config: any }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/llm`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return handleResponse(response);
};

export const createGlobalMCPServer = async (server: {
  name: string;
  url: string;
  connection_type?: string;
  api_key?: string;
  headers?: Record<string, string>;
}): Promise<{ status: string; server: any }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/mcp`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(server),
  });
  return handleResponse(response);
};

export const listGlobalMCPServers = async (): Promise<{ status: string; servers: any[] }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/mcp`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const updateGlobalMCPServer = async (
  id: number,
  server: {
    name: string;
    url: string;
    connection_type?: string;
    api_key?: string;
    headers?: Record<string, string>;
  }
): Promise<{ status: string; server: any }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/mcp/${id}`, {
    method: "PUT",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(server),
  });
  return handleResponse(response);
};

export const deleteGlobalMCPServer = async (id: number): Promise<{ status: string; message: string }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/mcp/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const toggleGlobalMCPServer = async (id: number): Promise<{ status: string; server: any }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/mcp/${id}/toggle`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const listGlobalLLMConfigs = async (): Promise<{ status: string; configs: any[] }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/llm`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const updateGlobalLLMConfig = async (
  id: number,
  config: {
    type: string;
    model: string;
    api_key?: string;
    base_url?: string;
    is_default?: boolean;
  }
): Promise<{ status: string; config: any }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/llm/${id}`, {
    method: "PUT",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return handleResponse(response);
};

export const deleteGlobalLLMConfig = async (id: number): Promise<{ status: string; message: string }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/llm/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const toggleGlobalLLMConfig = async (id: number): Promise<{ status: string; config: any }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/global-config/llm/${id}/toggle`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// --- Advanced User Management ---

export const deleteUserPermanently = async (userId: number): Promise<{ status: string; message: string }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getUserDetails = async (userId: number): Promise<any> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/details`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getUserSessions = async (userId: number): Promise<any[]> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/sessions`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getUserSessionMessages = async (userId: number, sessionId: string): Promise<any[]> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/sessions/${sessionId}/messages`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// --- Analytics ---

export const getSystemActivity = async (limit: number = 50): Promise<any[]> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/analytics/activity?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getUsageAnalytics = async (days: number = 30): Promise<any[]> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/analytics/usage?days=${days}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getModelAnalytics = async (days: number = 30): Promise<any[]> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/analytics/models?days=${days}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getTopUsersAnalytics = async (limit: number = 5, days: number = 30): Promise<any[]> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/admin/analytics/top-users?limit=${limit}&days=${days}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};
