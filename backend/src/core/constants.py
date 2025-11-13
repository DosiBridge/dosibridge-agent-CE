"""
Application constants
"""
# API Rate Limits
RATE_LIMIT_CHAT = "100/minute"
RATE_LIMIT_DEFAULT = "200/minute"

# Session defaults
DEFAULT_SESSION_ID = "default"

# Chat modes
CHAT_MODE_AGENT = "agent"
CHAT_MODE_RAG = "rag"

# LLM Providers
LLM_PROVIDER_OPENAI = "openai"
LLM_PROVIDER_GEMINI = "gemini"
LLM_PROVIDER_GROQ = "groq"
LLM_PROVIDER_OLLAMA = "ollama"

# Default LLM config
DEFAULT_LLM_TYPE = LLM_PROVIDER_OPENAI
DEFAULT_LLM_MODEL = "gpt-4o"

# Token expiration
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Streaming delays
STREAM_CHAR_DELAY = 0.005  # seconds between characters for smooth streaming

