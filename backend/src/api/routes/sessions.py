"""
Session management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from typing import Optional
from sqlalchemy.orm import Session
from src.core import User, get_db, DB_AVAILABLE, Conversation, Message
from src.core.auth import get_current_user
from src.services.db_history import db_history_manager
from src.services import history_manager
from ..models import SessionInfo

router = APIRouter()


@router.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get session information"""
    user_id = current_user.id if current_user else None
    
    # Use database history if available and user is authenticated
    if DB_AVAILABLE and user_id:
        messages = db_history_manager.get_session_messages(session_id, user_id, db)
    else:
        messages = history_manager.get_session_messages(session_id, user_id)
    
    return SessionInfo(
        session_id=session_id,
        message_count=len(messages),
        messages=[
            {
                "role": "user" if isinstance(msg, HumanMessage) else "assistant",
                "content": msg.content
            }
            for msg in messages
        ]
    )


@router.delete("/session/{session_id}")
async def clear_session(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_user),
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


@router.get("/sessions")
async def list_sessions(
    current_user: Optional[User] = Depends(get_current_user),
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

