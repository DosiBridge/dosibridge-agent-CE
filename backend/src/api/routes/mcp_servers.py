"""
MCP Server Management Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from src.core import Config, get_db, MCPServer, User
from src.core.auth import get_current_active_user, get_current_user
from ..models import MCPServerRequest
from ..exceptions import UnauthorizedError, ValidationError, APIException
from src.utils.mcp_connection_test import test_mcp_connection
from src.utils.logger import app_logger

router = APIRouter()


@router.get("/mcp-servers")
async def list_mcp_servers(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """List all configured MCP servers for the authenticated user (including disabled ones)"""
    if not current_user:
        app_logger.warning("Unauthorized MCP server list access attempt")
        raise UnauthorizedError("Authentication required")
    
    try:
        app_logger.info("Listing MCP servers", {"user_id": current_user.id})
        
        # Check if user is superadmin
        is_superadmin = current_user.role == "superadmin" if current_user else False
        
        # Load servers for the current user AND global servers
        # - Superadmins see ALL global servers (enabled and disabled)
        # - Regular users see ONLY ENABLED global servers
        from sqlalchemy import or_, and_
        
        if is_superadmin:
            # Superadmin sees ALL global servers (enabled and disabled)
            # Global servers are owned by superadmin (user_id=1) or None (for backward compatibility)
            db_servers = db.query(MCPServer).filter(
                or_(
                    MCPServer.user_id == current_user.id,  # User's own servers (all)
                    MCPServer.user_id == 1,                # Global servers owned by superadmin
                    MCPServer.user_id.is_(None)             # Global servers (backward compatibility)
                )
            ).order_by(
                MCPServer.user_id.asc(),  # User servers first, then global (1 and None come after)
                MCPServer.created_at.desc()
            ).all()
        else:
            # Regular users see ONLY ENABLED global servers
            # Global servers are owned by superadmin (user_id=1) or None (for backward compatibility)
            db_servers = db.query(MCPServer).filter(
                or_(
                    MCPServer.user_id == current_user.id,  # User's own servers (all, including disabled)
                    and_(
                        or_(MCPServer.user_id == 1, MCPServer.user_id.is_(None)),  # Global servers (user_id=1 or None)
                        MCPServer.enabled == True      # But only enabled ones
                    )
                )
            ).order_by(
                MCPServer.user_id.asc(),  # User servers first, then global (1 and None come after)
                MCPServer.created_at.desc()
            ).all()
        
        # Don't send api_key in response for security
        safe_servers = []
        for server in db_servers:
            safe_server = server.to_dict(include_api_key=False)
            safe_server["has_api_key"] = bool(server.api_key)
            safe_server["user_id"] = server.user_id  # Include user_id to identify global servers
            safe_server["is_global"] = (server.user_id == 1 or server.user_id is None)  # Mark global servers (user_id=1 or None)
            # Ensure enabled field exists (default to True if not present)
            if "enabled" not in safe_server:
                safe_server["enabled"] = True
            safe_servers.append(safe_server)
        
        user_servers = [s for s in safe_servers if not s.get('is_global')]
        global_servers = [s for s in safe_servers if s.get('is_global')]
        
        app_logger.info(
            "MCP servers listed successfully",
            {"user_id": current_user.id, "user_count": len(user_servers), "global_count": len(global_servers), "total": len(safe_servers)}
        )
        
        return {
            "status": "success",
            "count": len(safe_servers),
            "servers": safe_servers
        }
    except (APIException, HTTPException):
        raise
    except Exception as e:
        app_logger.error(
            "Error listing MCP servers",
            {"user_id": current_user.id, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="An error occurred while listing MCP servers")


@router.post("/mcp-servers")
async def add_mcp_server(
    server: MCPServerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a new MCP server to the configuration. Requires authentication - servers are user-specific."""
    try:
        # Get connection type (default to http)
        connection_type = (server.connection_type or "http").lower()
        if connection_type not in ("stdio", "http", "sse"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid connection_type: {connection_type}. Must be 'stdio', 'http', or 'sse'"
            )
        
        # Normalize URL based on connection type
        if connection_type == "stdio":
            # For stdio, url is the command (don't normalize)
            normalized_url = server.url.strip()
        else:
            # For http/sse, normalize URL
            normalized_url = server.url.rstrip('/')
            if connection_type == "sse":
                if normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url[:-4] + '/sse'
                elif not normalized_url.endswith('/sse'):
                    normalized_url = normalized_url.rstrip('/') + '/sse'
            else:  # http
                if normalized_url.endswith('/sse'):
                    normalized_url = normalized_url[:-4]
                if not normalized_url.endswith('/mcp'):
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
        
        # Test connection before saving
        app_logger.info(
            "Testing MCP server connection",
            {
                "user_id": current_user.id,
                "server_name": server.name,
                "connection_type": connection_type,
                "url": normalized_url
            }
        )
        connection_ok, connection_message = await test_mcp_connection(
            normalized_url,
            connection_type=connection_type,
            api_key=server.api_key if server.api_key else None,
            headers=server.headers if server.headers else None,
            timeout=5.0
        )
        
        if not connection_ok:
            app_logger.warning(
                "MCP server connection test failed",
                {
                    "user_id": current_user.id,
                    "server_name": server.name,
                    "error": connection_message
                }
            )
            raise ValidationError(f"Connection test failed: {connection_message}. Server not saved.")
        
        app_logger.info(
            "MCP server connection test successful",
            {"user_id": current_user.id, "server_name": server.name}
        )
        
        # Create new server with user_id (only if connection test passed)
        mcp_server = MCPServer(
            user_id=current_user.id,
            name=server.name,
            url=normalized_url,
            connection_type=connection_type,
            enabled=server.enabled if server.enabled is not None else True
        )
        # Use set_api_key() method to automatically encrypt
        mcp_server.set_api_key(server.api_key if server.api_key else None)
        # Set headers
        mcp_server.set_headers(server.headers if server.headers else None)
        db.add(mcp_server)
        db.commit()
        db.refresh(mcp_server)
        
        # Get total count for this user
        total_servers = db.query(MCPServer).filter(MCPServer.user_id == current_user.id).count()
        
        app_logger.info(
            "MCP server added successfully",
            {
                "user_id": current_user.id,
                "server_name": server.name,
                "total_servers": total_servers
            }
        )
        
        return {
            "status": "success",
            "message": f"MCP server '{server.name}' added successfully (connection verified)",
            "server": mcp_server.to_dict(include_api_key=False),
            "total_servers": total_servers
        }
    except (APIException, HTTPException):
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(
            "Error adding MCP server",
            {
                "user_id": current_user.id,
                "server_name": server.name,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="An error occurred while adding the MCP server")


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
        
        # Get connection type (default to existing or http)
        connection_type = (server.connection_type or mcp_server.connection_type or "http").lower()
        if connection_type not in ("stdio", "http", "sse"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid connection_type: {connection_type}. Must be 'stdio', 'http', or 'sse'"
            )
        
        # Normalize URL based on connection type
        if connection_type == "stdio":
            # For stdio, url is the command (don't normalize)
            normalized_url = server.url.strip()
        else:
            # For http/sse, normalize URL
            normalized_url = server.url.rstrip('/')
            if connection_type == "sse":
                if normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url[:-4] + '/sse'
                elif not normalized_url.endswith('/sse'):
                    normalized_url = normalized_url.rstrip('/') + '/sse'
            else:  # http
                if normalized_url.endswith('/sse'):
                    normalized_url = normalized_url[:-4]
                if not normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Test connection before updating (only if URL, connection_type, API key, or headers changed)
        url_changed = mcp_server.url != normalized_url
        connection_type_changed = mcp_server.connection_type != connection_type
        api_key_changed = server.api_key and server.api_key != mcp_server.api_key
        headers_changed = server.headers is not None and server.headers != mcp_server.get_headers()
        
        if url_changed or connection_type_changed or api_key_changed or headers_changed:
            print(f"🔍 Testing {connection_type} connection to updated MCP server: {normalized_url}")
            # Use new headers if provided, otherwise use existing
            test_headers = server.headers if server.headers is not None else mcp_server.get_headers()
            connection_ok, connection_message = await test_mcp_connection(
                normalized_url,
                connection_type=connection_type,
                api_key=server.api_key if server.api_key else mcp_server.get_api_key(),
                headers=test_headers if test_headers else None,
                timeout=5.0
            )
            
            if not connection_ok:
                raise HTTPException(
                    status_code=400,
                    detail=f"Connection test failed: {connection_message}. Server not updated."
                )
            
            print(f"✓ Connection test successful for {server.name} ({connection_type})")
        
        # Update server (only if connection test passed)
        mcp_server.name = server.name
        mcp_server.url = normalized_url
        mcp_server.connection_type = connection_type
        mcp_server.enabled = server.enabled if server.enabled is not None else True
        # Use set_api_key() method to automatically encrypt
        if server.api_key is not None:
            mcp_server.set_api_key(server.api_key)
        # Set headers if provided
        if server.headers is not None:
            mcp_server.set_headers(server.headers)
        
        db.commit()
        db.refresh(mcp_server)
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' updated successfully (connection verified)" if (url_changed or api_key_changed) else f"MCP server '{server_name}' updated successfully",
            "server": mcp_server.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp-servers/test-connection")
async def test_mcp_server_connection(
    server: MCPServerRequest,
    current_user: Optional[User] = Depends(get_current_user)
):
    """Test MCP server connection without saving. Requires authentication."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Get connection type (default to http)
        connection_type = (server.connection_type or "http").lower()
        if connection_type not in ("stdio", "http", "sse"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid connection_type: {connection_type}. Must be 'stdio', 'http', or 'sse'"
            )
        
        # Normalize URL based on connection type
        if connection_type == "stdio":
            normalized_url = server.url.strip()
        else:
            normalized_url = server.url.rstrip('/')
            if connection_type == "sse":
                if normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url[:-4] + '/sse'
                elif not normalized_url.endswith('/sse'):
                    normalized_url = normalized_url.rstrip('/') + '/sse'
            else:  # http
                if normalized_url.endswith('/sse'):
                    normalized_url = normalized_url[:-4]
                if not normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Test connection
        connection_ok, connection_message = await test_mcp_connection(
            normalized_url,
            connection_type=connection_type,
            api_key=server.api_key if server.api_key else None,
            headers=server.headers if server.headers else None,
            timeout=5.0
        )
        
        return {
            "status": "success" if connection_ok else "failed",
            "connected": connection_ok,
            "message": connection_message,
            "url": normalized_url,
            "connection_type": connection_type
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/mcp-servers/{server_name}/toggle")
async def toggle_mcp_server(
    server_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle enabled/disabled status of an MCP server. Requires authentication - users can only toggle their own servers, NOT global servers."""
    if not server_name or not server_name.strip():
        raise HTTPException(status_code=400, detail="Server name is required")
    
    try:
        # Find server owned by this user (NOT global servers)
        mcp_server = db.query(MCPServer).filter(
            MCPServer.user_id == current_user.id,  # Only user's own servers
            MCPServer.name == server_name
        ).first()
        
        if not mcp_server:
            # Check if it's a global server (owned by superadmin ID=1 or None for backward compatibility)
            from sqlalchemy import or_
            global_server = db.query(MCPServer).filter(
                or_(MCPServer.user_id == 1, MCPServer.user_id.is_(None)),
                MCPServer.name == server_name
            ).first()
            if global_server:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot toggle global MCP servers. Only superadmin (ID=1) can enable/disable global servers."
                )
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # If enabling, test connection first
        if not mcp_server.enabled:
            connection_type = mcp_server.connection_type or "http"
            print(f"🔍 Testing {connection_type} connection before enabling MCP server: {mcp_server.url}")
            connection_ok, connection_message = await test_mcp_connection(
                mcp_server.url,
                connection_type=connection_type,
                api_key=mcp_server.get_api_key(),
                timeout=5.0
            )
            
            if not connection_ok:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot enable server: {connection_message}"
                )
            print(f"✓ Connection test successful for {server_name}")
        
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

