"""
Pydantic models for API requests and responses
"""
from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    mode: str = "agent"  # "agent" or "rag"


class ChatResponse(BaseModel):
    response: str
    session_id: str
    mode: str
    tools_used: list = []


class SessionInfo(BaseModel):
    session_id: str
    message_count: int
    messages: list


class MCPServerRequest(BaseModel):
    name: str
    url: str
    connection_type: Optional[str] = "http"  # "stdio", "http", or "sse"
    api_key: Optional[str] = None  # Optional API key/auth key for MCP server
    headers: Optional[dict] = None  # Optional custom headers as key-value pairs
    enabled: Optional[bool] = True  # Whether the server is enabled


class LLMConfigRequest(BaseModel):
    type: str  # "openai", "groq", "ollama", or "gemini"
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # For Ollama
    api_base: Optional[str] = None  # Custom API base for OpenAI/Groq

