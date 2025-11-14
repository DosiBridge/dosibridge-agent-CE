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
    await websocket.accept()
    
    # Get user if authenticated (optional)
    user_id = None
    if token:
        try:
            from src.core.auth import decode_access_token
            payload = decode_access_token(token)
            if payload:
                user_id_str = payload.get("sub")
                if user_id_str:
                    try:
                        user_id = int(user_id_str)
                    except (ValueError, TypeError):
                        user_id = None
        except Exception as e:
            print(f"⚠️  Error verifying token in WebSocket: {e}")
    
    try:
        # Send initial health status
        health_status = await get_health_status(None, user_id)
        await websocket.send_json(health_status)
        
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
                            break
                    except json.JSONDecodeError:
                        # Invalid JSON, ignore
                        pass
                except asyncio.TimeoutError:
                    # Timeout - send periodic health update
                    health_status = await get_health_status(None, user_id)
                    await websocket.send_json(health_status)
                    
            except WebSocketDisconnect:
                # Client disconnected
                break
            except Exception as e:
                print(f"⚠️  Error in WebSocket health endpoint: {e}")
                # Send error status
                await websocket.send_json({
                    "status": "error",
                    "version": "1.0.0",
                    "rag_available": False,
                    "mcp_servers": 0,
                    "error": str(e)
                })
                break
                
    except WebSocketDisconnect:
        # Normal disconnect
        pass
    except Exception as e:
        print(f"⚠️  WebSocket connection error: {e}")

