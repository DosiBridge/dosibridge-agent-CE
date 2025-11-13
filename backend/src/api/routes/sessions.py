"""
Session management endpoints
"""
from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage
from typing import Optional
from src.services import history_manager
from src.core import User
from src.core.auth import get_current_user
from ..models import SessionInfo

router = APIRouter()


@router.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_user)
):
    """Get session information"""
    user_id = current_user.id if current_user else None
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
    current_user: Optional[User] = Depends(get_current_user)
):
    """Clear session history"""
    user_id = current_user.id if current_user else None
    history_manager.clear_session(session_id, user_id)
    return {"status": "success", "message": f"Session {session_id} cleared"}


@router.get("/sessions")
async def list_sessions(current_user: Optional[User] = Depends(get_current_user)):
    """List all active sessions for the current user (or all if not authenticated)"""
    user_id = current_user.id if current_user else None
    sessions = history_manager.list_sessions(user_id)
    return {
        "sessions": [
            {
                "session_id": sid,
                "message_count": len(history_manager.get_session_messages(sid, user_id))
            }
            for sid in sessions
        ]
    }

