/**
 * MCP Servers API client
 */

import type { MCPServer, MCPServerRequest } from "@/types/api";
import { getApiBaseUrl, getAuthHeaders, handleResponse } from "./client";

export async function listMCPServers(): Promise<{
  servers: MCPServer[];
  count: number;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{
    status?: string;
    servers: MCPServer[];
    count: number;
  }>(response);
  // Backend returns {status, servers, count}, extract just servers and count
  return { servers: data.servers, count: data.count };
}

export async function testMCPServerConnection(
  server: MCPServerRequest
): Promise<{ connected: boolean; message: string; url: string }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/mcp-servers/test-connection`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(server),
    }
  );
  return handleResponse(response);
}

export async function addMCPServer(
  server: MCPServerRequest
): Promise<{ server: MCPServer; message: string }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(server),
  });
  return handleResponse(response);
}

export async function updateMCPServer(
  name: string,
  server: MCPServerRequest
): Promise<{ server: MCPServer; message: string }> {
  if (!name || !name.trim()) {
    throw new Error("Server name is required");
  }
  // URL encode the server name to handle special characters
  const encodedName = encodeURIComponent(name.trim());
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers/${encodedName}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(server),
  });
  return handleResponse(response);
}

export async function deleteMCPServer(name: string): Promise<void> {
  if (!name || !name.trim()) {
    throw new Error("Server name is required");
  }
  // URL encode the server name to handle special characters
  const encodedName = encodeURIComponent(name.trim());
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers/${encodedName}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  await handleResponse(response);
}

export async function toggleMCPServer(
  name: string
): Promise<{ server: MCPServer; message: string }> {
  if (!name || !name.trim()) {
    throw new Error("Server name is required");
  }
  // URL encode the server name to handle special characters
  const encodedName = encodeURIComponent(name.trim());
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/mcp-servers/${encodedName}/toggle`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
}

export async function toggleGlobalMCPServerPreference(
  serverId: number
): Promise<{ status: string; message: string; preference: any }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers/global/${serverId}/toggle-preference`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}
