/**
 * API Usage Monitoring API client
 */

import { getApiBaseUrl, getAuthHeaders, handleResponse } from "./client";

export interface UsageStats {
  today: {
    request_count: number;
    remaining: number;
    limit: number;
    input_tokens: number;
    output_tokens: number;
    embedding_tokens: number;
    llm_provider?: string;
    llm_model?: string;
  };
  recent_days: Array<{
    id: number;
    user_id?: number;
    usage_date: string;
    request_count: number;
    llm_provider?: string;
    llm_model?: string;
    input_tokens: number;
    output_tokens: number;
    embedding_tokens: number;
    total_tokens: number;
    mode?: string;
    created_at?: string;
    updated_at?: string;
  }>;
  total_requests: number;
  total_tokens: number;
  days_analyzed: number;
}

export interface TodayUsage {
  request_count: number;
  remaining: number;
  limit: number;
  is_allowed: boolean;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  total_tokens: number;
  llm_provider?: string;
  llm_model?: string;
}

export interface APIKeysInfo {
  active_provider: string;
  active_model: string;
  keys_configured: {
    openai: {
      set: boolean;
      purpose: string;
      used_for: string;
    };
    deepseek: {
      set: boolean;
      purpose: string;
      used_for: string;
    };
    google: {
      set: boolean;
      purpose: string;
      used_for: string;
    };
    groq: {
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

export interface UsageStatsResponse {
  status: string;
  data: UsageStats;
}

export interface TodayUsageResponse {
  status: string;
  data: TodayUsage;
}

export interface APIKeysInfoResponse {
  status: string;
  data: APIKeysInfo;
}

/**
 * Get usage statistics for the current user
 */
export async function getUsageStats(days: number = 7): Promise<UsageStats> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/usage/stats?days=${days}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data: UsageStatsResponse = await handleResponse(response);
  return data.data;
}

/**
 * Get today's usage and remaining requests
 */
export async function getTodayUsage(): Promise<TodayUsage> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/usage/today`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data: TodayUsageResponse = await handleResponse(response);
  return data.data;
}

/**
 * Get information about which API keys are being used
 */
export async function getAPIKeysInfo(): Promise<APIKeysInfo> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/usage/keys`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data: APIKeysInfoResponse = await handleResponse(response);
  return data.data;
}

