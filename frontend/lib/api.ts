/**
 * API client for backend communication
 */

// Runtime config loader - reads from public/runtime-config.json if available
// This allows the API URL to be configured at container startup time
let runtimeConfig: { API_BASE_URL?: string } | null = null;
let configLoadPromise: Promise<string> | null = null;

// Get API base URL - loads runtime config on first call, then caches it
async function getApiBaseUrl(): Promise<string> {
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
      // Try to fetch runtime config from public directory
      const response = await fetch('/runtime-config.json', {
        cache: 'no-store', // Always fetch fresh config
      });
      if (response.ok) {
        runtimeConfig = await response.json();
        if (runtimeConfig?.API_BASE_URL) {
          return runtimeConfig.API_BASE_URL;
        }
      }
    } catch (error) {
      // Silently fail and use build-time config
      console.debug('Runtime config not available, using build-time config');
    }
    
    // Fall back to build-time env var
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8085';
  })();
  
  return configLoadPromise;
}

export interface ChatRequest {
  message: string;
  session_id: string;
  mode: "agent" | "rag";
}

export interface ChatResponse {
  response: string;
  session_id: string;
  mode: string;
  tools_used: string[];
}

export interface StreamChunk {
  chunk: string;
  done: boolean;
  tool?: string;
  tools_used?: string[];
  error?: string;
}

export interface Session {
  session_id: string;
  message_count: number;
}

export interface SessionInfo {
  session_id: string;
  message_count: number;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface MCPServer {
  name: string;
  url: string;
  has_api_key?: boolean;
  enabled?: boolean;
}

export interface MCPServerRequest {
  name: string;
  url: string;
  api_key?: string;
  enabled?: boolean;
}

export interface LLMConfig {
  type: "openai" | "groq" | "ollama" | "gemini";
  model: string;
  api_key?: string;
  base_url?: string;
  api_base?: string;
}

export interface LLMConfigResponse {
  type: string;
  model: string;
  has_api_key?: boolean;
  base_url?: string;
  api_base?: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  rag_available: boolean;
  mcp_servers: number;
}

export interface ToolsInfo {
  local_tools: Array<{
    name: string;
    description: string;
    type: string;
  }>;
  mcp_servers: Array<{
    name: string;
    url: string;
    status: string;
  }>;
}

// Helper function to handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// Chat API
export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<ChatResponse>(response);
}

// Streaming chat API
export function createStreamReader(
  request: ChatRequest,
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): () => void {
  const abortController = new AbortController();
  let isAborted = false;

  (async () => {
    const apiBaseUrl = await getApiBaseUrl();
    return fetch(`${apiBaseUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: abortController.signal,
    })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ detail: response.statusText }));
        throw new Error(
          error.detail || error.message || `HTTP ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || isAborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (isAborted) break;

            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.slice(6);
                if (!jsonStr) continue;

                const data = JSON.parse(jsonStr) as StreamChunk;
                onChunk(data);

                if (data.done || data.error) {
                  onComplete();
                  return;
                }
              } catch (e) {
                console.error(
                  "Failed to parse SSE data:",
                  e,
                  "Line:",
                  trimmedLine
                );
                // Continue processing other lines
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim() && !isAborted) {
          const trimmedBuffer = buffer.trim();
          if (trimmedBuffer.startsWith("data: ")) {
            try {
              const jsonStr = trimmedBuffer.slice(6);
              if (jsonStr) {
                const data = JSON.parse(jsonStr) as StreamChunk;
                onChunk(data);
              }
            } catch (e) {
              console.error("Failed to parse remaining buffer:", e);
            }
          }
        }

        if (!isAborted) {
          onComplete();
        }
      } catch (error) {
        if (
          !isAborted &&
          error instanceof Error &&
          error.name !== "AbortError"
        ) {
          onError(error);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {
          // Reader already released
        }
      }
    })
    .catch((error) => {
      if (!isAborted && error.name !== "AbortError") {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  })(); // Invoke the async IIFE

  return () => {
    isAborted = true;
    abortController.abort();
  };
}

// Session API
export async function getSession(sessionId: string): Promise<SessionInfo> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/session/${sessionId}`);
  return handleResponse<SessionInfo>(response);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/session/${sessionId}`, {
    method: "DELETE",
  });
  await handleResponse(response);
}

export async function listSessions(): Promise<{ sessions: Session[] }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/sessions`);
  return handleResponse<{ sessions: Session[] }>(response);
}

// MCP Servers API
export async function listMCPServers(): Promise<{
  servers: MCPServer[];
  count: number;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers`);
  const data = await handleResponse<{
    status?: string;
    servers: MCPServer[];
    count: number;
  }>(response);
  // Backend returns {status, servers, count}, extract just servers and count
  return { servers: data.servers, count: data.count };
}

export async function addMCPServer(
  server: MCPServerRequest
): Promise<{ server: MCPServer; message: string }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/mcp-servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const response = await fetch(
    `${apiBaseUrl}/api/mcp-servers/${encodedName}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(server),
    }
  );
  return handleResponse(response);
}

export async function deleteMCPServer(name: string): Promise<void> {
  if (!name || !name.trim()) {
    throw new Error("Server name is required");
  }
  // URL encode the server name to handle special characters
  const encodedName = encodeURIComponent(name.trim());
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/mcp-servers/${encodedName}`,
    {
      method: "DELETE",
    }
  );
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
    }
  );
  return handleResponse(response);
}

// LLM Config API
export async function getLLMConfig(): Promise<{ config: LLMConfigResponse }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/llm-config`);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

// Health API
export async function getHealth(): Promise<HealthStatus> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/health`);
  return handleResponse<HealthStatus>(response);
}

// Tools API
export async function getToolsInfo(): Promise<ToolsInfo> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/tools`);
  return handleResponse<ToolsInfo>(response);
}
