"""
Pydantic models for API requests and responses
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000, description="Chat message")
    session_id: str = Field(default="default", min_length=1, max_length=255, description="Session identifier")
    mode: Literal["agent", "rag"] = Field(default="agent", description="Chat mode: 'agent' (default, no auth required) or 'rag' (requires authentication)")
    collection_id: Optional[int] = Field(None, description="Optional collection ID for RAG mode")
    use_react: bool = Field(default=False, description="Whether to use ReAct agent for RAG mode")
    agent_prompt: Optional[str] = Field(None, max_length=5000, description="Optional custom system prompt for the agent. If not provided, a default prompt will be used.")
    
    @validator('message')
    def validate_message(cls, v):
        """Validate message is not empty"""
        if not v or not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()
    
    @validator('session_id')
    def validate_session_id(cls, v):
        """Validate session ID format"""
        if not v or not v.strip():
            raise ValueError("Session ID cannot be empty")
        return v.strip()


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
    name: str = Field(..., min_length=1, max_length=100, description="MCP server name")
    url: str = Field(..., min_length=1, max_length=500, description="Server URL or command")
    connection_type: Literal["stdio", "http", "sse"] = Field(default="http", description="Connection type")
    api_key: Optional[str] = Field(None, max_length=500, description="Optional API key for MCP server")
    headers: Optional[dict] = Field(None, description="Optional custom headers as key-value pairs")
    enabled: Optional[bool] = Field(default=True, description="Whether the server is enabled")
    
    @validator('name')
    def validate_name(cls, v):
        """Validate server name"""
        if not v or not v.strip():
            raise ValueError("Server name cannot be empty")
        return v.strip()
    
    @validator('url')
    def validate_url(cls, v):
        """Validate URL"""
        if not v or not v.strip():
            raise ValueError("URL cannot be empty")
        return v.strip()


class LLMConfigRequest(BaseModel):
    type: Literal["openai", "groq", "ollama", "gemini"] = Field(..., description="LLM provider type")
    model: str = Field(..., min_length=1, max_length=100, description="Model name")
    api_key: Optional[str] = Field(None, max_length=500, description="API key for the LLM provider")
    base_url: Optional[str] = Field(None, max_length=500, description="Base URL (for Ollama)")
    api_base: Optional[str] = Field(None, max_length=500, description="Custom API base (for OpenAI/Groq)")
    
    @validator('model')
    def validate_model(cls, v):
        """Validate model name"""
        if not v or not v.strip():
            raise ValueError("Model name cannot be empty")
        return v.strip()


class CollectionRequest(BaseModel):
    name: str
    description: Optional[str] = None


class AddTextRequest(BaseModel):
    """Request model for adding text directly to RAG system"""
    title: str = Field(..., min_length=1, max_length=500, description="Document title")
    content: str = Field(..., min_length=1, description="Text content to add")
    collection_id: Optional[int] = Field(None, description="Optional collection ID")
    chunk_size: Optional[int] = Field(1000, ge=100, le=5000, description="Chunk size in characters")
    chunk_overlap: Optional[int] = Field(200, ge=0, le=1000, description="Chunk overlap in characters")
    metadata: Optional[dict] = Field(None, description="Additional metadata")
    
    @validator('content')
    def validate_content(cls, v):
        """Validate content is not empty"""
        if not v or not v.strip():
            raise ValueError("Content cannot be empty")
        return v.strip()
    
    @validator('title')
    def validate_title(cls, v):
        """Validate title is not empty"""
        if not v or not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()

