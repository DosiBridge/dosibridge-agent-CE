"""
Session management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from src.core import User, get_db, DB_AVAILABLE, Conversation, Message
from src.core.auth import get_current_user
from src.services.db_history import db_history_manager
from src.services import history_manager
from ..models import SessionInfo

router = APIRouter()


class UpdateSessionRequest(BaseModel):
    title: str


@router.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get session information with full message metadata"""
    import json
    from datetime import datetime
    
    user_id = current_user.id if current_user else None
    
    # Use database history if available and user is authenticated
    if DB_AVAILABLE and user_id:
        messages = db_history_manager.get_session_messages(session_id, user_id, db)
        
        # If using database, get full message data including timestamps and tool_calls
        conversation = db.query(Conversation).filter(
            Conversation.session_id == session_id,
            Conversation.user_id == user_id
        ).first()
        
        if conversation:
            db_messages = db.query(Message).filter(
                Message.conversation_id == conversation.id
            ).order_by(Message.created_at.asc()).all()
            
            formatted_messages = []
            for db_msg in db_messages:
                tool_calls_data = None
                if db_msg.tool_calls:
                    try:
                        tool_calls_data = json.loads(db_msg.tool_calls)
                        # Extract tool names for tools_used
                        tools_used = []
                        if isinstance(tool_calls_data, list):
                            for tc in tool_calls_data:
                                if isinstance(tc, dict) and 'name' in tc:
                                    tools_used.append(tc['name'])
                        tool_calls_data = tools_used if tools_used else None
                    except json.JSONDecodeError:
                        tool_calls_data = None
                
                formatted_messages.append({
                    "role": db_msg.role,
                    "content": db_msg.content,
                    "created_at": db_msg.created_at.isoformat() if db_msg.created_at else None,
                    "tools_used": tool_calls_data or [],
                    "sources": []  # Sources not stored in Message model currently
                })
            
            return SessionInfo(
                session_id=session_id,
                message_count=len(formatted_messages),
                messages=formatted_messages
            )
        else:
            # Fallback to LangChain messages if conversation not found
            messages = db_history_manager.get_session_messages(session_id, user_id, db)
    else:
        messages = history_manager.get_session_messages(session_id, user_id)
    
    # Fallback: convert LangChain messages to API format
    formatted_messages = []
    for msg in messages:
        tools_used = []
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                if isinstance(tc, dict) and 'name' in tc:
                    tools_used.append(tc['name'])
                elif hasattr(tc, 'name'):
                    tools_used.append(tc.name)
        
        formatted_messages.append({
            "role": "user" if isinstance(msg, HumanMessage) else "assistant",
            "content": msg.content,
            "created_at": None,  # In-memory messages don't have timestamps
            "tools_used": tools_used,
            "sources": getattr(msg, "sources", []) if hasattr(msg, "sources") else []
        })
    
    return SessionInfo(
        session_id=session_id,
        message_count=len(formatted_messages),
        messages=formatted_messages
    )


@router.delete("/session/{session_id}")
async def clear_session(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete a session - removes conversation and all messages.
    
    - If authenticated: Deletes from database (permanent storage)
    - If not authenticated: Deletes from in-memory storage (temporary, lost on server restart)
    """
    user_id = current_user.id if current_user else None
    
    # Use database history if available and user is authenticated
    if DB_AVAILABLE and user_id:
        # Delete from database (permanent)
        db_history_manager.clear_session(session_id, user_id, db)
        return {
            "status": "success", 
            "message": f"Session {session_id} deleted from database",
            "deleted_from": "database"
        }
    else:
        # Delete from in-memory (temporary)
        history_manager.clear_session(session_id, user_id)
        return {
            "status": "success", 
            "message": f"Session {session_id} cleared (temporary - will be lost on server restart)",
            "deleted_from": "memory"
        }


@router.put("/session/{session_id}")
async def update_session(
    session_id: str,
    request_data: UpdateSessionRequest,
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update session title.
    
    - If authenticated: Updates in database (permanent storage)
    - If not authenticated: Updates in-memory storage (temporary)
    """
    title = request_data.title
    
    user_id = current_user.id if current_user else None
    
    # Use database history if available and user is authenticated
    if DB_AVAILABLE and user_id:
        # Update in database
        conversation = db.query(Conversation).filter(
            Conversation.session_id == session_id,
            Conversation.user_id == user_id
        ).first()
        
        if conversation:
            conversation.title = title
            db.commit()
            return {
                "status": "success",
                "message": f"Session {session_id} title updated",
                "title": title
            }
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        # For in-memory, we can't update title easily, but we'll return success
        # The frontend will handle local storage updates
        return {
            "status": "success",
            "message": f"Session {session_id} title updated (local storage)",
            "title": title
        }


@router.get("/sessions")
async def list_sessions(
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all active sessions for the current user (or all if not authenticated)"""
    user_id = current_user.id if current_user else None
    
    # Use database history if available and user is authenticated
    if DB_AVAILABLE and user_id:
        sessions = db_history_manager.list_sessions(user_id, db)
        return {
            "sessions": [
                {
                    "session_id": session["session_id"],
                    "title": session.get("title"),
                    "summary": session.get("summary"),  # Include summary
                    "message_count": session.get("message_count", 0),
                    "updated_at": session.get("updated_at")
                }
                for session in sessions
            ]
        }
    else:
        # Fallback to in-memory
        session_ids = history_manager.list_sessions(user_id)
        return {
            "sessions": [
                {
                    "session_id": sid,
                    "message_count": len(history_manager.get_session_messages(sid, user_id))
                }
                for sid in session_ids
            ]
        }

