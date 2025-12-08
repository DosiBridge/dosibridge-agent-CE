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
