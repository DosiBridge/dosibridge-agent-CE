"""
Superadmin routes for user management and system settings
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from src.core import get_db, User, LLMConfig, DB_AVAILABLE
from src.core.models import User as UserModel
from src.core.auth import get_current_active_user
from src.services.usage_tracker import usage_tracker
from sqlalchemy.sql import func

router = APIRouter()


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    role: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None


class SystemStatsResponse(BaseModel):
    total_users: int
    active_users: int
    blocked_users: int
    total_conversations: int
    total_documents: int
    total_mcp_servers: int


def get_current_superadmin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get the current superadmin user (requires superadmin role)"""
    # Check if user has superadmin role
    if not hasattr(current_user, 'role') or getattr(current_user, 'role', 'user') != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    return current_user


@router.get("/users", response_model=List[UserResponse])
async def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """List all users (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    users = db.query(UserModel).order_by(UserModel.created_at.desc()).all()
    return [user.to_dict() for user in users]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get a specific user (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user.to_dict()


@router.put("/users/{user_id}/block")
async def block_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Block a user (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if hasattr(user, 'role') and user.role == "superadmin":
        raise HTTPException(status_code=400, detail="Cannot block superadmin user")
    
    user.is_active = False
    db.commit()
    db.refresh(user)
    
    return {"status": "success", "message": "User blocked successfully", "user": user.to_dict()}


@router.put("/users/{user_id}/unblock")
async def unblock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Unblock a user (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = True
    db.commit()
    db.refresh(user)
    
    return {"status": "success", "message": "User unblocked successfully", "user": user.to_dict()}


@router.get("/system/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get system statistics (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    from src.core.models import Conversation, Document, MCPServer
    
    total_users = db.query(UserModel).count()
    active_users = db.query(UserModel).filter(UserModel.is_active == True).count()
    total_conversations = db.query(Conversation).count() if Conversation else 0
    total_documents = db.query(Document).count() if Document else 0
    total_mcp_servers = db.query(MCPServer).count() if MCPServer else 0
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "blocked_users": total_users - active_users,
        "total_conversations": total_conversations,
        "total_documents": total_documents,
        "total_mcp_servers": total_mcp_servers
    }


@router.get("/system/usage-history")
async def get_system_usage_history(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get system-wide usage history (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    return usage_tracker.get_system_usage_history(db, days=days)


# --- Global Configuration Routes ---

class GlobalLLMConfigRequest(BaseModel):
    type: str
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_default: bool = False

class GlobalMCPRequest(BaseModel):
    name: str
    url: str
    connection_type: str = "http"
    api_key: Optional[str] = None
    headers: Optional[dict] = None

@router.post("/global-config/llm")
async def create_global_llm_config(
    config: GlobalLLMConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Create a global LLM configuration (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    # Create new config with user_id = None
    new_config = LLMConfig(
        user_id=None,  # Global
        type=config.type,
        model=config.model,
        base_url=config.base_url,
        is_default=config.is_default
    )
    
    if config.api_key:
        from src.utils.encryption import encrypt_value
        new_config.api_key = encrypt_value(config.api_key)
        
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    
    return {"status": "success", "config": new_config.to_dict()}

@router.post("/global-config/mcp")
async def create_global_mcp_server(
    server: GlobalMCPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Add a global MCP server (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import MCPServer
    
    # Check if name already exists globally
    existing = db.query(MCPServer).filter(MCPServer.user_id.is_(None), MCPServer.name == server.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Global MCP server with this name already exists")
        
    new_server = MCPServer(
        user_id=None,  # Global
        name=server.name,
        url=server.url,
        connection_type=server.connection_type,
        enabled=True
    )
    
    new_server.set_api_key(server.api_key)
    new_server.set_headers(server.headers)
    
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    
    return {"status": "success", "server": new_server.to_dict()}

@router.delete("/global-config/mcp/{server_id}")
async def delete_global_mcp_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Delete a global MCP server (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import MCPServer
    
    server = db.query(MCPServer).filter(MCPServer.id == server_id, MCPServer.user_id.is_(None)).first()
    if not server:
        raise HTTPException(status_code=404, detail="Global MCP server not found")
        
    db.delete(server)
    db.commit()
    
    return {"status": "success", "message": "Global MCP server deleted"}


# --- User Inspection & Enhanced Management ---

@router.delete("/users/{user_id}")
async def delete_user_permanently(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Permanently delete a user and all their data (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    user_to_delete = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
        
    if hasattr(user_to_delete, 'role') and user_to_delete.role == "superadmin":
        raise HTTPException(status_code=400, detail="Cannot delete superadmin user")
        
    db.delete(user_to_delete)
    db.commit()
    
    return {"status": "success", "message": f"User {user_to_delete.name} permanently deleted"}

@router.get("/users/{user_id}/sessions")
async def get_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get all chat sessions for a specific user (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import Conversation
    
    sessions = db.query(Conversation).filter(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc()).all()
    return [session.to_dict() for session in sessions]

@router.get("/users/{user_id}/sessions/{session_id}/messages")
async def get_user_session_messages(
    user_id: int,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get messages for a specific user session (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import Conversation
    
    # Verify session belongs to user
    conversation = db.query(Conversation).filter(
        Conversation.user_id == user_id, 
        Conversation.session_id == session_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found for this user")
        
    return [msg.to_dict() for msg in conversation.messages]

@router.get("/users/{user_id}/details")
async def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get comprehensive user details (stats, configs, etc.)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Gather stats
    chat_count = len(user.conversations)
    doc_count = len(user.documents)
    mcp_count = len(user.mcp_servers)
    
    return {
        "profile": user.to_dict(),
        "stats": {
            "chats": chat_count,
            "documents": doc_count,
            "mcp_servers": mcp_count
        },
        "mcp_servers": [s.to_dict() for s in user.mcp_servers],
        "llm_configs": [c.to_dict() for c in user.llm_configs]
    }


# --- System Analytics ---

@router.get("/analytics/activity")
async def get_system_activity(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get recent system activity log (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import APIRequest, User as UserModel
    
    # query API requests and join with user to get names
    # activity is essentially API requests for now, but in future could be a dedicated EventLog
    requests = db.query(APIRequest).order_by(APIRequest.created_at.desc()).limit(limit).all()
    
    activity = []
    for req in requests:
        user_name = "Anonymous"
        if req.user_id:
            user = db.query(UserModel).filter(UserModel.id == req.user_id).first()
            if user:
                user_name = user.name
                
        activity.append({
            "id": req.id,
            "user": user_name,
            "action": f"Used {req.llm_model or 'System'}",
            "details": f"Tokens: {req.total_tokens}",
            "time": req.created_at.isoformat() if req.created_at else None,
            "status": "success" if req.success else "failed"
        })
        
    return activity

@router.get("/analytics/usage")
async def get_usage_analytics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get aggregated token usage analytics (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import APIUsage
    from datetime import datetime, timedelta
    
    cutoff = datetime.now() - timedelta(days=days)
    
    # Aggregate daily usage
    daily_stats = db.query(
        APIUsage.usage_date,
        func.sum(APIUsage.input_tokens + APIUsage.output_tokens + APIUsage.embedding_tokens).label('total_tokens'),
        func.sum(APIUsage.input_tokens).label('input_tokens'),
        func.sum(APIUsage.output_tokens).label('output_tokens'),
        func.sum(APIUsage.request_count).label('request_count')
    ).filter(
        APIUsage.usage_date >= cutoff
    ).group_by(
        APIUsage.usage_date
    ).order_by(
        APIUsage.usage_date
    ).all()
    
    return [
        {
            "date": stat.usage_date.isoformat().split('T')[0],
            "tokens": int(stat.total_tokens or 0),
            "input_tokens": int(stat.input_tokens or 0),
            "output_tokens": int(stat.output_tokens or 0),
            "requests": int(stat.request_count or 0)
        }
        for stat in daily_stats
    ]

@router.get("/analytics/models")
async def get_model_usage_analytics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get model usage distribution (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import APIUsage
    from datetime import datetime, timedelta
    
    cutoff = datetime.now() - timedelta(days=days)
    
    # Aggregate by model
    model_stats = db.query(
        APIUsage.llm_model,
        func.sum(APIUsage.request_count).label('request_count')
    ).filter(
        APIUsage.usage_date >= cutoff
    ).group_by(
        APIUsage.llm_model
    ).order_by(
        func.sum(APIUsage.request_count).desc()
    ).all()
    
    return [
        {
            "name": stat.llm_model or "Unknown",
            "value": int(stat.request_count or 0)
        }
        for stat in model_stats
    ]

@router.get("/analytics/top-users")
async def get_top_users_analytics(
    limit: int = 5,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Get top users by token consumption (superadmin only)"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
        
    from src.core.models import APIUsage, User as UserModel
    from datetime import datetime, timedelta
    
    cutoff = datetime.now() - timedelta(days=days)
    
    # Aggregate by user
    user_stats = db.query(
        APIUsage.user_id,
        func.sum(APIUsage.input_tokens + APIUsage.output_tokens + APIUsage.embedding_tokens).label('total_tokens')
    ).filter(
        APIUsage.usage_date >= cutoff,
        APIUsage.user_id.isnot(None)
    ).group_by(
        APIUsage.user_id
    ).order_by(
        func.sum(APIUsage.input_tokens + APIUsage.output_tokens + APIUsage.embedding_tokens).desc()
    ).limit(limit).all()
    
    result = []
    for stat in user_stats:
        user = db.query(UserModel).filter(UserModel.id == stat.user_id).first()
        if user:
            result.append({
                "name": user.name,
                "email": user.email,
                "tokens": int(stat.total_tokens or 0)
            })
            
    return result
