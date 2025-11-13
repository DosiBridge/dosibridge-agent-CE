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

# Conversation summary configuration
SUMMARY_UPDATE_MILESTONES = [10, 25, 50, 100, 200, 500]  # Message counts to update summary
SUMMARY_MAX_MESSAGES = 50  # Max messages to include in summary (for short conversations)
SUMMARY_MAX_MESSAGES_LONG = 100  # Max messages for longer conversations (>100 messages)
ENABLE_MESSAGE_CLEANUP = True  # Auto-delete old messages after summary
KEEP_LAST_N_MESSAGES = 20  # Keep last N messages even after cleanup

