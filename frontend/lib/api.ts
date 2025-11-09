/**
 * API client for backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface ChatRequest {
  message: string;
  session_id: string;
  mode: 'agent' | 'rag';
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
    role: 'user' | 'assistant';
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
  type: 'openai' | 'groq' | 'ollama' | 'gemini';
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
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// Chat API
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || error.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || isAborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (isAborted) break;
            
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith('data: ')) {
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
                console.error('Failed to parse SSE data:', e, 'Line:', trimmedLine);
                // Continue processing other lines
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim() && !isAborted) {
          const trimmedBuffer = buffer.trim();
          if (trimmedBuffer.startsWith('data: ')) {
            try {
              const jsonStr = trimmedBuffer.slice(6);
              if (jsonStr) {
                const data = JSON.parse(jsonStr) as StreamChunk;
                onChunk(data);
              }
            } catch (e) {
              console.error('Failed to parse remaining buffer:', e);
            }
          }
        }

        if (!isAborted) {
          onComplete();
        }
      } catch (error) {
        if (!isAborted && error instanceof Error && error.name !== 'AbortError') {
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
      if (!isAborted && error.name !== 'AbortError') {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    });

  return () => {
    isAborted = true;
    abortController.abort();
  };
}

// Session API
export async function getSession(sessionId: string): Promise<SessionInfo> {
  const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`);
  return handleResponse<SessionInfo>(response);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`, {
    method: 'DELETE',
  });
  await handleResponse(response);
}

export async function listSessions(): Promise<{ sessions: Session[] }> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`);
  return handleResponse<{ sessions: Session[] }>(response);
}

// MCP Servers API
export async function listMCPServers(): Promise<{ servers: MCPServer[]; count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/mcp-servers`);
  const data = await handleResponse<{ servers: MCPServer[]; count: number }>(response);
  return data;
}

export async function addMCPServer(server: MCPServerRequest): Promise<{ server: MCPServer; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/mcp-servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
  return handleResponse(response);
}

export async function updateMCPServer(name: string, server: MCPServerRequest): Promise<{ server: MCPServer; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/mcp-servers/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
  return handleResponse(response);
}

export async function deleteMCPServer(name: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/mcp-servers/${name}`, {
    method: 'DELETE',
  });
  await handleResponse(response);
}

export async function toggleMCPServer(name: string): Promise<{ server: MCPServer; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/mcp-servers/${name}/toggle`, {
    method: 'PATCH',
  });
  return handleResponse(response);
}

// LLM Config API
export async function getLLMConfig(): Promise<{ config: LLMConfigResponse }> {
  const response = await fetch(`${API_BASE_URL}/api/llm-config`);
  return handleResponse(response);
}

export async function setLLMConfig(config: LLMConfig): Promise<{ message: string; config: LLMConfigResponse }> {
  const response = await fetch(`${API_BASE_URL}/api/llm-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

// Health API
export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return handleResponse<HealthStatus>(response);
}

// Tools API
export async function getToolsInfo(): Promise<ToolsInfo> {
  const response = await fetch(`${API_BASE_URL}/api/tools`);
  return handleResponse<ToolsInfo>(response);
}
