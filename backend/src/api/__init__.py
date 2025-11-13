"""
FastAPI application with streaming chat endpoints
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .lifespan import mcp_lifespan
from .routes import (
    chat_router,
    sessions_router,
    tools_router,
    mcp_servers_router,
    llm_config_router,
    mcp_routes_router,
    auth_router,
    setup_mcp_routes,
)

# Initialize FastAPI app with MCP lifespan
app = FastAPI(
    title="AI MCP Agent API",
    description="Intelligent agent with RAG, MCP tools, and conversation memory",
    version="1.0.0",
    lifespan=mcp_lifespan
)

# Initialize rate limiter
# Rate limits: 100 requests per minute for chat endpoints, 200 for others
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri="memory://"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply rate limiting middleware (applies default limits to all routes)
from slowapi.middleware import SlowAPIMiddleware
app.add_middleware(SlowAPIMiddleware)

# Configure CORS origins from environment variable
# Format: comma-separated list of origins, e.g., "http://localhost:3000,http://localhost:3001,https://example.com"
CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "")

# Default CORS origins for local development if not set
if not CORS_ORIGINS_ENV:
    default_origins = [
        "http://localhost:3000",
        "http://localhost:8086",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8086",
        "http://localhost:8086",
    ]
    cors_origins = default_origins
    print(f"⚠️  CORS_ORIGINS not set, using defaults: {cors_origins}")
else:
    # Parse comma-separated origins
    cors_origins = [origin.strip() for origin in CORS_ORIGINS_ENV.split(",") if origin.strip()]
    if not cors_origins:
        raise ValueError("CORS_ORIGINS environment variable is empty or invalid")
    print(f"✅ CORS configured with origins: {cors_origins}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # List of allowed origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  # Explicitly allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers to the client
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(sessions_router, prefix="/api", tags=["sessions"])
app.include_router(tools_router, prefix="/api", tags=["tools"])
app.include_router(mcp_servers_router, prefix="/api", tags=["mcp-servers"])
app.include_router(llm_config_router, prefix="/api", tags=["llm-config"])
app.include_router(mcp_routes_router, prefix="/api", tags=["mcp-routes"])

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
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

