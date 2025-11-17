"""
MCP routes setup
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.mcp import MCP_SERVERS, get_mcp_server, list_available_servers
from fastapi import HTTPException, APIRouter

router = APIRouter()


def setup_mcp_routes(app: FastAPI):
    """Setup dynamic routes for MCP servers with CORS support"""
    # Get CORS origins from environment (same as main app)
    CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "")
    
    if not CORS_ORIGINS_ENV:
        default_origins = [
            "http://localhost:3000",
            "http://localhost:8086",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8086",
        ]
        cors_origins = default_origins
    else:
        cors_origins = [origin.strip() for origin in CORS_ORIGINS_ENV.split(",") if origin.strip()]
    
    for server_name, server_instance in MCP_SERVERS.items():
        # Create a mount point for each server
        if hasattr(server_instance, 'streamable_http_app'):
            http_app = server_instance.streamable_http_app()
            
            # Add CORS middleware to the mounted app
            # This is necessary because mounted apps don't inherit parent middleware
            # Allow requests without origin (server-to-server requests) and from allowed origins
            http_app.add_middleware(
                CORSMiddleware,
                allow_origins=cors_origins,
                allow_origin_regex=None,  # Don't use regex
                allow_credentials=True,
                allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                allow_headers=["*"],
                expose_headers=["*"],
                max_age=3600,
            )
            
            app.mount(f"/api/mcp/{server_name}", http_app, name=f"mcp_{server_name}")


@router.get("/mcp-servers/available")
async def list_local_mcp_servers():
    """List all locally available MCP servers"""
    try:
        servers = list_available_servers()
        return {
            "status": "success",
            "servers": servers,
            "count": len(servers)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mcp/{server_name}/info")
async def get_mcp_server_info(server_name: str):
    """Get information about a specific MCP server"""
    try:
        server = get_mcp_server(server_name)
        if not server:
            raise HTTPException(
                status_code=404, 
                detail=f"MCP server '{server_name}' not found. Available servers: {', '.join(list_available_servers())}"
            )
        
        # Try to get server info
        info = {
            "name": server_name,
            "available": True,
        }
        
        # Try to get tools if available
        if hasattr(server, 'list_tools'):
            try:
                tools = server.list_tools()
                info["tools"] = [{"name": tool.get("name"), "description": tool.get("description")} for tool in tools]
            except:
                pass
        
        return {
            "status": "success",
            "server": info
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

