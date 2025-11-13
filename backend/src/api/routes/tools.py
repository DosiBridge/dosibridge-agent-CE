"""
Tools information endpoints
"""
from fastapi import APIRouter
from src.core import Config

router = APIRouter()


@router.get("/tools")
async def get_tools_info():
    """Get information about available tools"""
    mcp_servers = Config.load_mcp_servers()
    
    tools_info = {
        "local_tools": [
            {
                "name": "retrieve_dosiblog_context",
                "description": "Retrieves information about DosiBlog project",
                "type": "rag"
            }
        ],
        "mcp_servers": []
    }
    
    # We can't easily get MCP tools without connecting, so just return server info
    for server in mcp_servers:
        tools_info["mcp_servers"].append({
            "name": server.get("name"),
            "url": server.get("url"),
            "status": "configured"
        })
    
    return tools_info

