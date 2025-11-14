"""
Core domain models and database configuration
"""
from .database import Base, get_db, get_db_context, init_db, DB_AVAILABLE
from .models import User, LLMConfig, MCPServer, Conversation, Message, DocumentCollection, CustomRAGTool
from .config import Config
from .constants import (
    RATE_LIMIT_CHAT,
    RATE_LIMIT_DEFAULT,
    DEFAULT_SESSION_ID,
    CHAT_MODE_AGENT,
    CHAT_MODE_RAG,
    LLM_PROVIDER_OPENAI,
    LLM_PROVIDER_GEMINI,
    LLM_PROVIDER_GROQ,
    LLM_PROVIDER_OLLAMA,
    DEFAULT_LLM_TYPE,
    DEFAULT_LLM_MODEL,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

# Import auth functions for convenience
from .auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

__all__ = [
    "Base",
    "get_db",
    "get_db_context",
    "init_db",
    "DB_AVAILABLE",
    "User",
    "LLMConfig",
    "MCPServer",
    "Conversation",
    "Message",
    "DocumentCollection",
    "CustomRAGTool",
    "Config",
    "get_password_hash",
    "verify_password",
    "create_access_token",
    "get_current_user",
    "get_current_active_user",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    # Constants
    "RATE_LIMIT_CHAT",
    "RATE_LIMIT_DEFAULT",
    "DEFAULT_SESSION_ID",
    "CHAT_MODE_AGENT",
    "CHAT_MODE_RAG",
    "LLM_PROVIDER_OPENAI",
    "LLM_PROVIDER_GEMINI",
    "LLM_PROVIDER_GROQ",
    "LLM_PROVIDER_OLLAMA",
    "DEFAULT_LLM_TYPE",
    "DEFAULT_LLM_MODEL",
]

