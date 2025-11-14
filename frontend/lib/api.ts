/**
 * API client for backend communication
 */

// Runtime config loader - reads from public/runtime-config.json if available
// This allows the API URL to be configured at container startup time
let runtimeConfig: { API_BASE_URL?: string } | null = null;
let configLoadPromise: Promise<string> | null = null;

// Get API base URL - loads runtime config on first call, then caches it
export async function getApiBaseUrl(): Promise<string> {
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
      // Try to fetch runtime config from API route (more reliable than static file)
      const response = await fetch("/api/runtime-config", {
        cache: "no-store", // Always fetch fresh config
      });
      if (response.ok) {
        runtimeConfig = await response.json();
        if (runtimeConfig?.API_BASE_URL) {
          return runtimeConfig.API_BASE_URL;
        }
      }
    } catch {
      // Silently fall back to default
    }

    // Fall back to build-time env var or default
    const fallbackUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8085";
    return fallbackUrl;
  })();

  return configLoadPromise;
}

export interface ChatRequest {
  message: string;
  session_id: string;
  mode: "agent" | "rag";
  collection_id?: number | null;
  use_react?: boolean;
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
  status?: string; // Status messages from backend (e.g., 'connected', 'initializing_agent')
}

export interface Session {
  session_id: string;
  title?: string;
  summary?: string;
  message_count: number;
  updated_at?: string;
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
  connection_type?: "stdio" | "http" | "sse";
  has_api_key?: boolean;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPServerRequest {
  name: string;
  url: string;
  connection_type?: "stdio" | "http" | "sse";
  api_key?: string;
  headers?: Record<string, string>;
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
    custom?: boolean;
    id?: number;
    collection_id?: number | null;
  }>;
  mcp_servers: Array<{
    name: string;
    url: string;
    status: string;
  }>;
}

// Custom RAG Tools API
export interface CustomRAGTool {
  id: number;
  name: string;
  description: string;
  collection_id: number | null;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustomRAGToolRequest {
  name: string;
  description: string;
  collection_id?: number | null;
  enabled?: boolean;
}

export async function createCustomRAGTool(
  tool: CustomRAGToolRequest
): Promise<CustomRAGTool> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/custom-rag-tools`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(tool),
  });
  return handleResponse<CustomRAGTool>(response);
}

export async function listCustomRAGTools(): Promise<CustomRAGTool[]> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/custom-rag-tools`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<CustomRAGTool[]>(response);
}

export async function getCustomRAGTool(toolId: number): Promise<CustomRAGTool> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/custom-rag-tools/${toolId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<CustomRAGTool>(response);
}

export async function updateCustomRAGTool(
  toolId: number,
  tool: CustomRAGToolRequest
): Promise<CustomRAGTool> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/custom-rag-tools/${toolId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(tool),
  });
  return handleResponse<CustomRAGTool>(response);
}

export async function deleteCustomRAGTool(toolId: number): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/custom-rag-tools/${toolId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  await handleResponse(response);
}

export async function toggleCustomRAGTool(
  toolId: number
): Promise<CustomRAGTool> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/custom-rag-tools/${toolId}/toggle`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
    }
  );
  return handleResponse<CustomRAGTool>(response);
}

// Token management
const TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

// Helper function to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Helper function to handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      removeAuthToken();
      // Redirect to login will be handled by the auth guard
      throw new Error("Unauthorized - Please login again");
    }

    // Try to parse error response
    let errorDetail: string;
    try {
      const error = await response.json();
      errorDetail = error.detail || error.message || response.statusText;
    } catch {
      errorDetail = response.statusText || `HTTP ${response.status}`;
    }

    // Create more descriptive error messages
    const errorMessages: Record<number, string> = {
      400: "Invalid request. Please check your input.",
      401: "Authentication required. Please log in.",
      403: "You don't have permission to perform this action.",
      404: "The requested resource was not found.",
      409: "A conflict occurred. The resource may already exist.",
      422: "Validation error. Please check your input.",
      429: "Too many requests. Please wait a moment and try again.",
      500: "Server error. Please try again later.",
      502: "Service temporarily unavailable. Please try again later.",
      503: "Service unavailable. Please try again later.",
    };

    const message = errorMessages[response.status] || errorDetail;
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = response.status;
    throw error;
  }
  return response.json();
}

// Auth API
export interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<AuthResponse>(response);
  setAuthToken(result.access_token);
  return result;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<AuthResponse>(response);
  setAuthToken(result.access_token);
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

// Chat API
export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: "POST",
    headers: getAuthHeaders(),
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
    try {
      const apiBaseUrl = await getApiBaseUrl();
      // Prepare request body with optional RAG parameters
      const requestBody: ChatRequest = {
        message: request.message,
        session_id: request.session_id,
        mode: request.mode,
      };
      if (request.mode === "rag") {
        if (
          request.collection_id !== undefined &&
          request.collection_id !== null
        ) {
          requestBody.collection_id = request.collection_id;
        }
        if (request.use_react !== undefined) {
          requestBody.use_react = request.use_react;
        }
      }

      const headers = getAuthHeaders();
      const url = `${apiBaseUrl}/api/chat/stream`;

      let response: Response;
      try {
        const fetchPromise = fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        // Add a timeout to detect if fetch hangs
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Fetch timeout after 30 seconds"));
          }, 30000);
        });

        response = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (fetchError) {
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        throw new Error(
          `Failed to connect to server: ${errorMessage}. Please check if the backend is running at ${url}.`
        );
      }

      if (!response.ok) {
        // For agent mode, 401 should not happen - backend allows unauthenticated access
        // But if it does, try to parse the error message
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          // Try to read the error response body
          const errorText = await response.text();
          if (errorText) {
            try {
              const error = JSON.parse(errorText);
              errorDetail = error.detail || error.message || errorDetail;
            } catch {
              // If not JSON, use the text as error detail
              errorDetail = errorText || errorDetail;
            }
          }
        } catch (parseError) {
          // If we can't read the response, use status text
          console.error("Failed to parse error response:", parseError);
        }

        // For 401 errors in agent mode, this shouldn't happen but handle gracefully
        if (response.status === 401 && request.mode === "agent") {
          // Agent mode should work without auth - this might be a backend configuration issue
          // Still throw the error but with a helpful message
          throw new Error(
            `Backend authentication error: ${errorDetail}. Agent mode should work without login. Please check backend configuration.`
          );
        }

        throw new Error(errorDetail);
      }

      // Check if response body exists
      if (!response.body) {
        throw new Error(
          `No response body received from server. Status: ${response.status} ${response.statusText}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (isAborted) {
            break;
          }

          if (value) {
            const decoded = decoder.decode(value, { stream: true });
            buffer += decoded;
          }

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (isAborted) break;

            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.slice(6);
                // Skip completely empty JSON strings
                if (jsonStr.trim() === "") continue;

                const data = JSON.parse(jsonStr) as StreamChunk;

                // Always call onChunk to handle status messages and chunks
                onChunk(data);

                if (data.done || data.error) {
                  onComplete();
                  return;
                }
              } catch {
                // Continue processing other lines - don't break the stream
                // Silently skip malformed lines
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
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr) as StreamChunk;
                onChunk(data);
                // If this was the final message, don't call onComplete again
                if (data.done || data.error) {
                  return;
                }
              }
            } catch {
              // Silently skip malformed buffer data
            }
          }
        }

        // Only call onComplete if we haven't already (stream ended normally)
        // This handles the case where the stream ends without a "done" message
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
        } else if (error instanceof Error && error.name === "AbortError") {
          onComplete();
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Reader already released
        }
      }
    } catch (error) {
      // Handle network errors or fetch failures
      if (error instanceof Error && error.name === "AbortError") {
        onComplete();
        return;
      }
      if (!isAborted) {
        const errorMessage =
          error instanceof Error
            ? error
            : new Error(
                `Network error: ${String(
                  error
                )}. Please check your connection and ensure the backend is running.`
              );
        onError(errorMessage);
      }
    }
  })(); // Invoke the async IIFE

  return () => {
    isAborted = true;
    abortController.abort();
  };
}

// Session API
export async function getSession(sessionId: string): Promise<SessionInfo> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/session/${sessionId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<SessionInfo>(response);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/session/${sessionId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  await handleResponse(response);
}

/**
 * Delete all sessions from the backend (if authenticated)
 */
export async function deleteAllSessions(): Promise<void> {
  try {
    const { sessions } = await listSessions();
    // Delete all sessions in parallel
    await Promise.all(
      sessions.map((session) => deleteSession(session.session_id))
    );
  } catch (error) {
    // If not authenticated or error, just continue (local storage will be cleared)
    console.warn("Failed to delete sessions from backend:", error);
  }
}

export async function listSessions(): Promise<{ sessions: Session[] }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/sessions`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<{ sessions: Session[] }>(response);
}

// MCP Servers API
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

// LLM Config API
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

// Documents API
export interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: "pending" | "processing" | "ready" | "error" | "needs_review";
  metadata?: Record<string, unknown>;
  chunk_count: number;
  embedding_status: string;
  collection_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentCollection {
  id: number;
  name: string;
  description?: string;
  document_count: number;
  created_at?: string;
  updated_at?: string;
}

export async function uploadDocument(
  file: File,
  collectionId?: number
): Promise<{ message: string; document: Document }> {
  const apiBaseUrl = await getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);
  if (collectionId) {
    formData.append("collection_id", collectionId.toString());
  }

  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/documents/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  return handleResponse(response);
}

export async function listDocuments(
  collectionId?: number,
  status?: string
): Promise<{ documents: Document[]; count: number }> {
  const apiBaseUrl = await getApiBaseUrl();
  const params = new URLSearchParams();
  if (collectionId) params.append("collection_id", collectionId.toString());
  if (status) params.append("status", status);

  const response = await fetch(
    `${apiBaseUrl}/api/documents?${params.toString()}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
}

export async function getDocument(
  documentId: number
): Promise<{ document: Document }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/documents/${documentId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function deleteDocument(documentId: number): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/documents/${documentId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  await handleResponse(response);
}

export async function approveDocument(
  documentId: number
): Promise<{ message: string }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/documents/${documentId}/approve`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
}

export async function rejectDocument(
  documentId: number,
  reason?: string
): Promise<{ message: string }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/documents/${documentId}/reject`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    }
  );
  return handleResponse(response);
}

export async function getDocumentsNeedingReview(): Promise<{
  documents: Document[];
  count: number;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/documents/review/needed`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getReviewStatistics(): Promise<{
  pending: number;
  needs_review: number;
  ready: number;
  error: number;
  total: number;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/documents/review/statistics`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
}

// Collections API
export async function createCollection(
  name: string,
  description?: string
): Promise<{ message: string; collection: DocumentCollection }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/collections`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, description }),
  });
  return handleResponse(response);
}

export async function listCollections(): Promise<{
  collections: DocumentCollection[];
  count: number;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/collections`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function deleteCollection(collectionId: number): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/collections/${collectionId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );
  await handleResponse(response);
}
