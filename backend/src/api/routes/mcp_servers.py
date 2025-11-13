"""
MCP Server Management Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from src.core import Config, get_db, MCPServer, User
from src.core.auth import get_current_active_user, get_current_user
from ..models import MCPServerRequest

router = APIRouter()


@router.get("/mcp-servers")
async def list_mcp_servers(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """List all configured MCP servers for the authenticated user (including disabled ones)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Load ALL servers for the current user (including disabled ones) for management UI
        # This is different from Config.load_mcp_servers which filters by enabled=True
        db_servers = db.query(MCPServer).filter(MCPServer.user_id == current_user.id).all()
        
        # Don't send api_key in response for security
        safe_servers = []
        for server in db_servers:
            safe_server = server.to_dict(include_api_key=False)
            safe_server["has_api_key"] = bool(server.api_key)
            # Ensure enabled field exists (default to True if not present)
            if "enabled" not in safe_server:
                safe_server["enabled"] = True
            safe_servers.append(safe_server)
        
        return {
            "status": "success",
            "count": len(safe_servers),
            "servers": safe_servers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp-servers")
async def add_mcp_server(
    server: MCPServerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a new MCP server to the configuration. Requires authentication - servers are user-specific."""
    try:
        # Normalize URL: remove /sse and ensure /mcp endpoint
        normalized_url = server.url.rstrip('/')
        if normalized_url.endswith('/sse'):
            normalized_url = normalized_url[:-4]  # Remove /sse
        if not normalized_url.endswith('/mcp'):
            # If URL doesn't end with /mcp, append it
            normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Check if server already exists for this user
        existing = db.query(MCPServer).filter(
            MCPServer.user_id == current_user.id,
            (MCPServer.name == server.name) | (MCPServer.url == normalized_url)
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"MCP server with name '{server.name}' or URL '{normalized_url}' already exists"
            )
        
        # Create new server with user_id
        mcp_server = MCPServer(
            user_id=current_user.id,
            name=server.name,
            url=normalized_url,
            api_key=server.api_key if server.api_key else None,
            enabled=server.enabled if server.enabled is not None else True
        )
        db.add(mcp_server)
        db.commit()
        db.refresh(mcp_server)
        
        # Get total count for this user
        total_servers = db.query(MCPServer).filter(MCPServer.user_id == current_user.id).count()
        
        return {
            "status": "success",
            "message": f"MCP server '{server.name}' added successfully",
            "server": mcp_server.to_dict(),
            "total_servers": total_servers
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/mcp-servers/{server_name}")
async def delete_mcp_server(
    server_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an MCP server from the configuration. Requires authentication - users can only delete their own servers."""
    if not server_name or not server_name.strip():
        raise HTTPException(status_code=400, detail="Server name is required")
    
    try:
        # Find server owned by this user
        mcp_server = db.query(MCPServer).filter(
            MCPServer.user_id == current_user.id,
            MCPServer.name == server_name
        ).first()
        
        if not mcp_server:
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # Delete server
        db.delete(mcp_server)
        db.commit()
        
        # Get remaining count for this user
        remaining_count = db.query(MCPServer).filter(MCPServer.user_id == current_user.id).count()
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' deleted successfully",
            "remaining_servers": remaining_count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/mcp-servers/{server_name}")
async def update_mcp_server(
    server_name: str,
    server: MCPServerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing MCP server. Requires authentication - users can only update their own servers."""
    if not server_name or not server_name.strip():
        raise HTTPException(status_code=400, detail="Server name is required")
    if not server.name or not server.name.strip():
        raise HTTPException(status_code=400, detail="Server name in request body is required")
    
    try:
        # Find server owned by this user
        mcp_server = db.query(MCPServer).filter(
            MCPServer.user_id == current_user.id,
            MCPServer.name == server_name
        ).first()
        
        if not mcp_server:
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # Normalize URL: remove /sse and ensure /mcp endpoint
        normalized_url = server.url.rstrip('/')
        if normalized_url.endswith('/sse'):
            normalized_url = normalized_url[:-4]  # Remove /sse
        if not normalized_url.endswith('/mcp'):
            # If URL doesn't end with /mcp, append it
            normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Update server
        mcp_server.name = server.name
        mcp_server.url = normalized_url
        mcp_server.enabled = server.enabled if server.enabled is not None else True
        if server.api_key:
            mcp_server.api_key = server.api_key
        
        db.commit()
        db.refresh(mcp_server)
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' updated successfully",
            "server": mcp_server.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/mcp-servers/{server_name}/toggle")
async def toggle_mcp_server(
    server_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle enabled/disabled status of an MCP server. Requires authentication - users can only toggle their own servers."""
    if not server_name or not server_name.strip():
        raise HTTPException(status_code=400, detail="Server name is required")
    
    try:
        # Find server owned by this user
        mcp_server = db.query(MCPServer).filter(
            MCPServer.user_id == current_user.id,
            MCPServer.name == server_name
        ).first()
        
        if not mcp_server:
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # Toggle enabled status
        mcp_server.enabled = not mcp_server.enabled
        db.commit()
        db.refresh(mcp_server)
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' {'enabled' if mcp_server.enabled else 'disabled'}",
            "server": mcp_server.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

