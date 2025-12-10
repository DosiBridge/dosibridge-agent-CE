/**
 * LLM Configuration API client
 */

import type { LLMConfig, LLMConfigResponse } from "@/types/api";
import { getApiBaseUrl, getAuthHeaders, handleResponse } from "./client";

export async function getLLMConfig(): Promise<{ config: LLMConfigResponse }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{
    status: string;
    config: LLMConfigResponse;
    has_api_key?: boolean;
  }>(response);
  // Backend returns {status, config, has_api_key}, but frontend expects {config}
  // Merge has_api_key into config if present
  if (data.has_api_key !== undefined && data.config) {
    data.config.has_api_key = data.has_api_key;
  }
  return { config: data.config };
}

export async function setLLMConfig(
  config: LLMConfig
): Promise<{ message: string; config: LLMConfigResponse }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

export async function testLLMConfig(
  config: LLMConfig
): Promise<{ status: string; message: string; valid: boolean }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/test`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

export async function resetLLMConfig(): Promise<{
  message: string;
  config: LLMConfigResponse;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/reset`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export interface LLMConfigListItem extends LLMConfigResponse {
  id: number;
  user_id?: number;
  active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function listLLMConfigs(): Promise<{
  configs: LLMConfigListItem[];
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/list`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{
    status: string;
    configs: LLMConfigListItem[];
  }>(response);
  return { configs: data.configs };
}

export async function updateLLMConfig(
  configId: number,
  config: LLMConfig
): Promise<{ message: string; config: LLMConfigResponse }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/${configId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

export async function deleteLLMConfig(
  configId: number
): Promise<{ message: string }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/${configId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function switchLLMConfig(
  configId: number
): Promise<{ message: string; config: LLMConfigResponse }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/${configId}/switch`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function toggleLLMConfig(
  configId: number
): Promise<{ message: string; config: LLMConfigResponse }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/${configId}/toggle`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function toggleGlobalLLMConfigPreference(
  configId: number
): Promise<{ message: string; preference: any }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config/global/${configId}/toggle-preference`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}
