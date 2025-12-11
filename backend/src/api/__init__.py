"""
FastAPI application with streaming chat endpoints
"""
import os
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from .lifespan import mcp_lifespan
from .routes import (
    chat_router,
    sessions_router,
    tools_router,
    mcp_servers_router,
    llm_config_router,
    mcp_routes_router,
    auth_router,

    admin_router,
    setup_mcp_routes,
)
from .routes.documents import router as documents_router
from .routes.websocket import router as websocket_router
from .routes.custom_rag_tools import router as custom_rag_tools_router
from .routes.monitoring import router as monitoring_router
from src.core.auth import get_current_user, get_optional_current_user
from src.core import User
from typing import Optional

# Try to import slowapi for rate limiting (optional)
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    from src.core.constants import RATE_LIMIT_DEFAULT
    SLOWAPI_AVAILABLE = True
except ImportError:
    print("⚠️  Warning: slowapi not installed. Rate limiting will be disabled.")
    print("   Install with: pip install slowapi")
    SLOWAPI_AVAILABLE = False
    Limiter = None
    _rate_limit_exceeded_handler = None
    get_remote_address = None
    RateLimitExceeded = None
    SlowAPIMiddleware = None
    RATE_LIMIT_DEFAULT = "200/minute"

# Initialize FastAPI app with MCP lifespan
app = FastAPI(
    title="AI MCP Agent API",
    description="Intelligent agent with RAG, MCP tools, and conversation memory",
    version="1.0.0",
    lifespan=mcp_lifespan
)

# Initialize rate limiter (if available)
if SLOWAPI_AVAILABLE:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[RATE_LIMIT_DEFAULT],
        storage_uri="memory://"
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    # Apply rate limiting middleware (applies default limits to all routes)
    app.add_middleware(SlowAPIMiddleware)
    print("✓ Rate limiting enabled")
else:
    # Create a dummy limiter for compatibility
    app.state.limiter = None
    print("⚠️  Rate limiting disabled (slowapi not installed)")

# Add custom middleware for request ID and logging
try:
    from .middleware import RequestIDMiddleware, LoggingMiddleware
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(LoggingMiddleware)
    print("✓ Custom middleware enabled")
except Exception as e:
    print(f"⚠️  Warning: Could not load custom middleware: {e}")

# Configure CORS origins from environment variable
CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "")

# Default CORS origins for local development if not set
if not CORS_ORIGINS_ENV:
    default_origins = [
        "http://localhost:3000",
        "http://localhost:8086",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8086",
    ]
    cors_origins = default_origins
    print(f"⚠️  CORS_ORIGINS not set, using defaults: {cors_origins}")
else:
    # Parse comma-separated origins
    cors_origins = [origin.strip() for origin in CORS_ORIGINS_ENV.split(",") if origin.strip()]
    if not cors_origins:
        raise ValueError("CORS_ORIGINS environment variable is empty or invalid")
    print(f"✅ CORS configured with origins: {cors_origins}")

# In production, also allow common production origins if not already included
# This helps with deployment scenarios where CORS_ORIGINS might not be fully configured
PRODUCTION_ORIGINS = [
    "https://agent.dosibridge.com",
    "https://www.agent.dosibridge.com",
]
# Add production origins if not already in the list (avoid duplicates)
is_production = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or os.getenv("NODE_ENV", "").lower() == "production"
if is_production:
    for origin in PRODUCTION_ORIGINS:
        if origin not in cors_origins:
            cors_origins.append(origin)
            print(f"✅ Added production origin to CORS: {origin}")

# Add CORS middleware LAST (so it executes FIRST)
# IMPORTANT: In FastAPI, middleware executes in REVERSE order (last added = first executed)
# CORS middleware must execute first to handle preflight OPTIONS requests properly
# Adding it last ensures it runs before other middleware can interfere
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)
print(f"🌐 CORS middleware configured with {len(cors_origins)} allowed origins: {cors_origins}")

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(sessions_router, prefix="/api", tags=["sessions"])
app.include_router(tools_router, prefix="/api", tags=["tools"])
app.include_router(mcp_servers_router, prefix="/api", tags=["mcp-servers"])
app.include_router(llm_config_router, prefix="/api", tags=["llm-config"])
app.include_router(mcp_routes_router, prefix="/api", tags=["mcp-routes"])
app.include_router(documents_router, prefix="/api", tags=["documents"])
app.include_router(websocket_router, prefix="/api", tags=["websocket"])
app.include_router(custom_rag_tools_router, prefix="/api", tags=["custom-rag-tools"])
app.include_router(monitoring_router, prefix="/api/monitoring", tags=["monitoring"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])


# Setup MCP routes
setup_mcp_routes(app)

# Health check and root endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "AI MCP Agent API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check(current_user: Optional[User] = Depends(get_optional_current_user)):
    """Health check endpoint with MCP server count and RAG availability"""
    from src.api.routes.websocket import get_health_status
    user_id = current_user.id if current_user else None
    return await get_health_status(None, user_id)
