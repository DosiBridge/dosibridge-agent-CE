/**
 * Chat API types
 */

export interface ChatRequest {
  message: string;
  session_id: string;
  mode: "agent" | "rag";
  collection_id?: number | null;
  use_react?: boolean;
  agent_prompt?: string;
  guest_email?: string;
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
  status?: "thinking" | "tool_calling" | "answering" | string; // Status messages from backend
}
