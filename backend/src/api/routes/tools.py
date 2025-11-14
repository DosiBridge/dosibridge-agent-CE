"""
Tools information endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from src.core import Config, get_db, User
from src.core.auth import get_current_user

router = APIRouter()


@router.get("/tools")
async def get_tools_info(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get information about available tools - USER-SPECIFIC.
    Requires authentication - returns only tools available to the authenticated user.
    """
    # Require authentication for MCP access
    if not current_user:
        # Return only local tools for unauthenticated users (no MCP access)
        return {
            "local_tools": [
                {
                    "name": "retrieve_dosiblog_context",
                    "description": "Retrieves information about DosiBlog project",
                    "type": "rag"
                }
            ],
            "mcp_servers": []
        }
    
    # Load user-specific MCP servers only
    mcp_servers = Config.load_mcp_servers(user_id=current_user.id, db=db)
    
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
    # Only include servers for the authenticated user
    for server in mcp_servers:
        tools_info["mcp_servers"].append({
            "name": server.get("name"),
            "url": server.get("url"),
            "status": "configured"
        })
    
    return tools_info

