"""
MCP routes setup
"""
from fastapi import FastAPI
from src.mcp import MCP_SERVERS, get_mcp_server, list_available_servers
from fastapi import HTTPException, APIRouter

router = APIRouter()


def setup_mcp_routes(app: FastAPI):
    """Setup dynamic routes for MCP servers"""
    for server_name, server_instance in MCP_SERVERS.items():
        # Create a mount point for each server
        if hasattr(server_instance, 'streamable_http_app'):
            http_app = server_instance.streamable_http_app()
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

