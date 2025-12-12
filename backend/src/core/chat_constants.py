"""
Chat-related constants
Following Refactoring.Guru: Replace Magic Number with Symbolic Constant
"""
from typing import Final

# Streaming configuration
STREAM_CHAR_DELAY_SECONDS: Final[float] = 0.005
STREAM_CONNECTION_DELAY_SECONDS: Final[float] = 0.1

# Content processing thresholds
MIN_TEXT_LENGTH_FOR_REVIEW: Final[int] = 100
MAX_TEXT_LENGTH_FOR_REVIEW: Final[int] = 1_000_000
MIN_NON_WHITESPACE_RATIO: Final[float] = 0.3

# RAG configuration
DEFAULT_RAG_RETRIEVAL_K: Final[int] = 5
DEFAULT_LLM_TEMPERATURE: Final[float] = 0.0

# Token estimation
DEFAULT_EMBEDDING_TOKENS: Final[int] = 0

# Error message limits
MAX_ERROR_TRACEBACK_LENGTH: Final[int] = 300
MAX_ERROR_DETAIL_LENGTH: Final[int] = 500

# Content type handling
CONTENT_TYPE_TEXT: Final[str] = "text"
CONTENT_TYPE_KEY: Final[str] = "type"

# Tool validation
UNKNOWN_TOOL_NAME: Final[str] = "unknown"

# Status messages
STATUS_CONNECTED: Final[str] = "connected"
STATUS_THINKING: Final[str] = "thinking"
STATUS_TOOL_CALLING: Final[str] = "tool_calling"
STATUS_ANSWERING: Final[str] = "answering"
STATUS_CREATING_AGENT: Final[str] = "creating_agent"
STATUS_AGENT_READY: Final[str] = "agent_ready"

# SSE event keys
EVENT_KEY_CHUNK: Final[str] = "chunk"
EVENT_KEY_DONE: Final[str] = "done"
EVENT_KEY_ERROR: Final[str] = "error"
EVENT_KEY_STATUS: Final[str] = "status"
EVENT_KEY_TOOL: Final[str] = "tool"
EVENT_KEY_TOOLS_USED: Final[str] = "tools_used"
EVENT_KEY_TOOL_COUNT: Final[str] = "tool_count"

# HTTP headers for SSE
SSE_CACHE_CONTROL: Final[str] = "no-cache"
SSE_CONNECTION: Final[str] = "keep-alive"
SSE_X_ACCEL_BUFFERING: Final[str] = "no"
SSE_CONTENT_TYPE: Final[str] = "text/event-stream; charset=utf-8"

# Rate limit messages
RATE_LIMIT_MESSAGE_TEMPLATE: Final[str] = "Daily request limit exceeded. You have used {current}/{limit} requests today."
RATE_LIMIT_UNAUTHENTICATED_SUFFIX: Final[str] = " Please create an account or log in to get 100 requests per day, or add your own API key for unlimited requests."
RATE_LIMIT_AUTHENTICATED_SUFFIX: Final[str] = " Please add your own API key for unlimited requests or try again tomorrow."

# LLM error messages
LLM_MISSING_CONFIG_MESSAGE: Final[str] = "No LLM configuration found. Please configure an LLM provider via environment variables or create a personal LLM config."
LLM_INVALID_KEY_MESSAGE: Final[str] = "LLM API key is invalid or missing. Please configure a valid API key via environment variables or create a personal LLM config."
LLM_MISSING_PACKAGE_MESSAGE: Final[str] = "Missing LLM package: {error}\n\nAll required packages should be pre-installed from requirements.txt.\nPlease redeploy after ensuring requirements.txt includes all LLM provider packages."

# Authentication messages
AUTH_REQUIRED_RAG_MESSAGE: Final[str] = "Authentication required for RAG mode. Please log in to upload documents and query them."
USER_INACTIVE_MESSAGE: Final[str] = "User account is inactive"

# Connection error messages
OLLAMA_CONNECTION_ERROR_TEMPLATE: Final[str] = (
    "Connection error to Ollama: {error}. "
    "Please check:\n"
    "- Ollama is running: docker ps | grep ollama\n"
    "- Base URL is correct (try http://localhost:11434 or http://host.docker.internal:11434)\n"
    "- Test connection: curl http://localhost:11434/api/tags"
)
OLLAMA_MODEL_NOT_FOUND_TEMPLATE: Final[str] = (
    "Model not found: {error}. "
    "Please check the model name is correct and the model is available in Ollama."
)

# Gemini-specific error messages
GEMINI_QUOTA_EXCEEDED_MESSAGE: Final[str] = (
    "Gemini API quota exceeded. Your API key has reached its rate limit. "
    "Solutions: 1) Wait a few minutes, 2) Enable billing in Google Cloud Console, "
    "3) Try a different model (e.g., gemini-1.5-flash), "
    "4) Check quota: https://ai.dev/usage?tab=rate-limit"
)
GEMINI_INVALID_KEY_MESSAGE: Final[str] = (
    "Invalid Google API key. Please check your API key in Settings. "
    "Get a new one from: https://aistudio.google.com/app/apikey"
)

# Agent error messages
AGENT_NO_RESPONSE_MESSAGE: Final[str] = "No response received from agent. Please check your LLM configuration and API keys."
AGENT_TOOL_VALIDATION_ERROR: Final[str] = "An internal error occurred while processing your request. Please try again or rephrase your question."
AGENT_CONNECTION_ERROR: Final[str] = "Connection error. Please check if Ollama is running and accessible."

