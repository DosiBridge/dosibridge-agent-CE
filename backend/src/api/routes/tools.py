"""
Tools information endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from src.core import Config, get_db, User, CustomRAGTool, DB_AVAILABLE
from src.core.auth import get_current_user, get_current_active_user

router = APIRouter()


@router.get("/tools")
async def get_tools_info(
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get information about available tools - USER-SPECIFIC.
    Requires authentication - returns only tools available to the authenticated user.
    """
    # Base local tools (always available)
    local_tools = [
        {
            "name": "retrieve_dosiblog_context",
            "description": "Retrieves information about DosiBlog project",
            "type": "rag"
        }
    ]
    
    # Require authentication for MCP access and custom RAG tools
    if not current_user:
        # Return only base local tools for unauthenticated users
        return {
            "local_tools": local_tools,
            "mcp_servers": []
        }
    
    # Load user-specific custom RAG tools
    if DB_AVAILABLE and CustomRAGTool is not None:
        try:
            custom_tools = db.query(CustomRAGTool).filter(
                CustomRAGTool.user_id == current_user.id,
                CustomRAGTool.enabled == True
            ).all()
            
            for tool in custom_tools:
                local_tools.append({
                    "name": tool.name,
                    "description": tool.description,
                    "type": "rag",
                    "custom": True,
                    "id": tool.id,
                    "collection_id": tool.collection_id
                })
        except Exception as e:
            print(f"⚠️  Error loading custom RAG tools: {e}")
    
    # Load user-specific MCP servers only
    mcp_servers = Config.load_mcp_servers(user_id=current_user.id, db=db)
    
    tools_info = {
        "local_tools": local_tools,
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

