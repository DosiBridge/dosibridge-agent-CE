/**
 * LLM Configuration API types
 */

export interface LLMConfig {
  type: "openai" | "deepseek" | "groq" | "ollama" | "gemini" | "openrouter";
  model: string;
  api_key?: string;
  base_url?: string;
  api_base?: string;
  use_default?: boolean;
}

export interface LLMConfigResponse {
  type: string;
  model: string;
  has_api_key?: boolean;
  base_url?: string;
  api_base?: string;
  is_default?: boolean;
  id?: number;
  user_id?: number | null;  // null for global configs
  active?: boolean;
  is_global?: boolean;  // True if this is a global config (user_id === null)
}

export interface LLMConfigListItem extends LLMConfigResponse {
  id: number;
  user_id?: number | null;
  active: boolean;
  is_default: boolean;
  is_global?: boolean;  // True if this is a global config (user_id === null)
  created_at?: string;
  updated_at?: string;
}
