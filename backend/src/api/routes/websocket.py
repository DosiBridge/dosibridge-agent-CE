"""
WebSocket endpoints for real-time connection monitoring
"""
import asyncio
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from src.core import get_db, DB_AVAILABLE, MCPServer, get_db_context

router = APIRouter()


async def get_health_status(db: Optional[Session] = None, user_id: Optional[int] = None) -> dict:
    """
    Get current health status including MCP servers count and RAG availability
    """
    try:
        # Count MCP servers
        mcp_count = 0
        if DB_AVAILABLE:
            try:
                if db:
                    query = db.query(MCPServer).filter(MCPServer.enabled == True)
                    if user_id is not None:
                        query = query.filter(MCPServer.user_id == user_id)
                    mcp_count = query.count()
                else:
                    from src.core import get_db_context
                    with get_db_context() as session:
                        query = session.query(MCPServer).filter(MCPServer.enabled == True)
                        if user_id is not None:
                            query = query.filter(MCPServer.user_id == user_id)
                        mcp_count = query.count()
            except Exception as e:
                print(f"⚠️  Error counting MCP servers: {e}")
                mcp_count = 0
        
        # Check RAG availability (check if advanced_rag system is available)
        rag_available = False
        try:
            from src.services.advanced_rag import advanced_rag_system
            rag_available = advanced_rag_system is not None
        except Exception:
            rag_available = False
        
        return {
            "status": "healthy",
            "version": "1.0.0",
            "rag_available": rag_available,
            "mcp_servers": mcp_count
        }
    except Exception as e:
        print(f"⚠️  Error getting health status: {e}")
        return {
            "status": "unhealthy",
            "version": "1.0.0",
            "rag_available": False,
            "mcp_servers": 0
        }


@router.websocket("/ws/health")
async def websocket_health(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    WebSocket endpoint for real-time health status updates
    
    Sends health status every 5 seconds to keep connection alive and provide updates.
    Client can send ping messages to request immediate status update.
    
    Optional query parameter: token - JWT token for authenticated users (for user-specific MCP server count)
    """
    # Accept WebSocket connection immediately
    # FastAPI's WebSocket.accept() handles the WebSocket handshake protocol
    # WebSocket connections don't use CORS in the same way as HTTP - they use the WebSocket protocol
    origin = websocket.headers.get("origin", "unknown")
    client_host = websocket.client.host if websocket.client else "unknown"
    
    try:
        # Accept the connection - this completes the WebSocket handshake
        # This must be called before any other operations
        await websocket.accept()
        print(f"✓ WebSocket connection accepted from {client_host} (origin: {origin})")
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"⚠️  Failed to accept WebSocket connection from {client_host}: {error_msg}")
        traceback.print_exc()
        
        # Check if connection was already closed or accepted
        if "already" in error_msg.lower() or "closed" in error_msg.lower():
            print("  → WebSocket connection was already processed")
        else:
            print(f"  → Error type: {type(e).__name__}")
        
        # Don't try to close if we couldn't accept - connection is already dead
        return
    
    # Get user if authenticated (optional)
    user_id = None
    if token:
        try:
            from src.core.auth0 import verify_auth0_token
            from src.core.models import User
            
            # Verify Auth0 token
            payload = verify_auth0_token(token)
            
            # Get email from payload (Auth0 puts email in claims)
            email = payload.get("email")
            
            if email:
                # Look up user in database to get ID
                with get_db_context() as db:
                    user = db.query(User).filter(User.email == email).first()
                    if user:
                        user_id = user.id
        except Exception as e:
            # Token validation failed - treat as anonymous
            # print(f"⚠️  Error verifying token in WebSocket: {e}") # Reduce log noise
            pass
    
    try:
        # Send initial health status
        health_status = await get_health_status(None, user_id)
        await websocket.send_json(health_status)
        print(f"✓ Sent initial health status to WebSocket client")
        
        # Keep connection alive and send periodic updates
        while True:
            try:
                # Wait for either a message from client or timeout
                # Use asyncio.wait_for to implement timeout
                try:
                    # Wait for client message with 5 second timeout
                    message = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                    
                    # Handle client messages
                    try:
                        data = json.loads(message)
                        if data.get("type") == "ping":
                            # Client requested immediate status update
                            health_status = await get_health_status(None, user_id)
                            await websocket.send_json({
                                **health_status,
                                "type": "pong"
                            })
                        elif data.get("type") == "close":
                            # Client requested to close connection
                            print("✓ WebSocket client requested close")
                            break
                    except json.JSONDecodeError:
                        # Invalid JSON, ignore
                        pass
                except asyncio.TimeoutError:
                    # Timeout - send periodic health update
                    health_status = await get_health_status(None, user_id)
                    await websocket.send_json(health_status)
                    
            except WebSocketDisconnect:
                # Client disconnected normally
                print("✓ WebSocket client disconnected")
                break
            except Exception as e:
                print(f"⚠️  Error in WebSocket health endpoint: {e}")
                import traceback
                traceback.print_exc()
                # Try to send error status before closing
                try:
                    await websocket.send_json({
                        "status": "error",
                        "version": "1.0.0",
                        "rag_available": False,
                        "mcp_servers": 0,
                        "error": str(e)
                    })
                except:
                    pass
                break
                
    except WebSocketDisconnect:
        # Normal disconnect
        print("✓ WebSocket disconnected normally")
    except Exception as e:
        print(f"⚠️  WebSocket connection error: {e}")
        import traceback
        traceback.print_exc()

