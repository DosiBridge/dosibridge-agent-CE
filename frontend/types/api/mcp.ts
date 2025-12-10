/**
 * MCP Servers API types
 */

export interface MCPServer {
  id?: number;  // Server ID from database
  name: string;
  url: string;
  connection_type?: "stdio" | "http" | "sse";
  has_api_key?: boolean;
  headers?: Record<string, string>;
  enabled?: boolean;
  user_id?: number | null;  // null for global servers
  is_global?: boolean;  // True if this is a global server (user_id === null)
  user_enabled?: boolean;  // User's preference for global servers
}

export interface MCPServerRequest {
  name: string;
  url: string;
  connection_type?: "stdio" | "http" | "sse";
  api_key?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}
