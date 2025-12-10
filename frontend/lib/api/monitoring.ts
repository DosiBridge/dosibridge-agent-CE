import { getApiBaseUrl, getAuthHeaders, handleResponse } from "./client";

export interface UsageStats {
  request_count: number;
  remaining: number;
  limit: number;
  is_allowed: boolean;
  is_default_llm: boolean;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  total_tokens: number;
  llm_provider?: string;
  llm_model?: string;
}

export interface ApiKeysInfo {
  active_provider: string;
  active_model: string;
  keys_configured: {
    openai: {
      set: boolean;
      purpose: string;
      used_for: string;
    };
    llm: {
      set: boolean;
      purpose: string;
      used_for: string;
    };
  };
  today_usage: {
    provider?: string;
    model?: string;
    input_tokens: number;
    output_tokens: number;
    embedding_tokens: number;
  };
}

export const getTodayUsage = async (): Promise<UsageStats> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/monitoring/usage/today`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; data: UsageStats }>(response);
  return data.data;
};

export const getApiKeysInfo = async (): Promise<ApiKeysInfo> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/monitoring/usage/keys`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; data: ApiKeysInfo }>(response);
  return data.data;
};

// Type aliases for compatibility
export type TodayUsage = UsageStats;

export interface PerRequestStats {
  period: string;
  timestamp?: string;
  request_count: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  avg_tokens_per_request: number;
  valid_requests?: number;
  invalid_requests?: number;
  llm_provider?: string;
  llm_model?: string;
}

export interface IndividualRequest {
  id: number;
  user_id?: number;
  request_timestamp: string;
  llm_provider?: string;
  llm_model?: string;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  total_tokens: number;
  mode?: string;
  session_id?: string;
  success: boolean;
  created_at?: string;
}

export interface IndividualRequestsResponse {
  requests: IndividualRequest[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface UsageStatsResponse {
  today: UsageStats;
  recent_days: Array<{
    date: string;
    request_count: number;
    input_tokens: number;
    output_tokens: number;
    embedding_tokens: number;
    total_tokens: number;
    llm_provider?: string;
    llm_model?: string;
  }>;
  total_requests: number;
  total_tokens: number;
  days_analyzed: number;
}

export const getUsageStats = async (days: number = 7): Promise<UsageStatsResponse> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/monitoring/usage/stats?days=${days}`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; data: UsageStatsResponse }>(response);
  return data.data;
};

export const getPerRequestStats = async (days: number = 7, groupBy: string = "hour"): Promise<{ requests: PerRequestStats[] }> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/monitoring/usage/per-request?days=${days}&group_by=${groupBy}`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; data: PerRequestStats[] }>(response);
  return { requests: data.data };
};

export const getIndividualRequests = async (days: number = 7, limit: number = 100, offset: number = 0): Promise<IndividualRequestsResponse> => {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/monitoring/usage/requests?days=${days}&limit=${limit}&offset=${offset}`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ status: string; data: IndividualRequestsResponse }>(response);
  return data.data;
};
