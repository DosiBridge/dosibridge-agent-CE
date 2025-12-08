"""
API Usage Monitoring Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from src.core import get_db, User
from src.core.auth import get_current_user, get_current_active_user
from src.services.usage_tracker import usage_tracker
from src.core.constants import DAILY_REQUEST_LIMIT

router = APIRouter()


@router.get("/usage/stats")
async def get_usage_stats(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = 7
):
    """
    Get current user's API usage statistics
    
    Args:
        current_user: Current authenticated user (optional)
        db: Database session
        days: Number of days to retrieve (default: 7)
        
    Returns:
        Usage statistics including today's usage, recent days, and totals
    """
    try:
        user_id = current_user.id if current_user else None
        
        stats = usage_tracker.get_user_usage_stats(user_id, db, days)
        
        return {
            "status": "success",
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {str(e)}")


@router.get("/usage/today")
async def get_today_usage(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get today's usage and remaining requests
    
    Args:
        current_user: Current authenticated user (optional)
        db: Database session
        
    Returns:
        Today's usage information
    """
    try:
        user_id = current_user.id if current_user else None
        
        # Check if user is using default LLM
        from src.core import Config
        llm_config = Config.load_llm_config(db=db, user_id=user_id)
        # Check if it's default DeepSeek: either marked as is_default=True, or
        # it's DeepSeek with is_default=True from database, or fallback DeepSeek
        is_default_llm = llm_config.get("is_default", False)
        
        # Also check if it's a DeepSeek config from database with is_default flag
        if not is_default_llm and user_id:
            from src.core.models import LLMConfig
            active_config = db.query(LLMConfig).filter(
                LLMConfig.user_id == user_id,
                LLMConfig.active == True
            ).first()
            if active_config and active_config.is_default and active_config.type == "deepseek":
                is_default_llm = True
        
        # Only check daily limit if using default LLM
        if is_default_llm:
            is_allowed, current_count, remaining = usage_tracker.check_daily_limit(user_id, db, is_default_llm=True)
        else:
            # Using custom API key - unlimited requests
            is_allowed = True
            current_count = 0
            remaining = -1  # -1 means unlimited
        
        stats = usage_tracker.get_user_usage_stats(user_id, db, days=1)
        today_stats = stats.get("today", {})
        
        return {
            "status": "success",
            "data": {
                "request_count": current_count,
                "remaining": remaining,
                "limit": DAILY_REQUEST_LIMIT if is_default_llm else -1,  # -1 means unlimited
                "is_allowed": is_allowed,
                "is_default_llm": is_default_llm,  # Add flag to indicate if using default LLM
                "input_tokens": today_stats.get("input_tokens", 0),
                "output_tokens": today_stats.get("output_tokens", 0),
                "embedding_tokens": today_stats.get("embedding_tokens", 0),
                "total_tokens": today_stats.get("input_tokens", 0) + today_stats.get("output_tokens", 0) + today_stats.get("embedding_tokens", 0),
                "llm_provider": today_stats.get("llm_provider"),
                "llm_model": today_stats.get("llm_model"),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get today's usage: {str(e)}")


@router.get("/usage/keys")
async def get_api_keys_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get information about which API keys are being used
    
    Args:
        current_user: Current authenticated user (required)
        db: Database session
        
    Returns:
        Information about API keys in use
    """
    try:
        import os
        
        # Get LLM config to see which provider is active
        from src.core import Config
        llm_config = Config.load_llm_config(db=db)
        
        # Get today's usage to see what was actually used
        stats = usage_tracker.get_user_usage_stats(current_user.id, db, days=1)
        today_stats = stats.get("today", {})
        
        # Check which keys are set
        # Only show OpenAI (for embeddings, not changeable) and DeepSeek (default LLM)
        openai_key_set = bool(os.getenv("OPENAI_API_KEY"))
        deepseek_key_set = bool(os.getenv("DEEPSEEK_KEY"))
        
        return {
            "status": "success",
            "data": {
                "active_provider": llm_config.get("type"),
                "active_model": llm_config.get("model"),
                "keys_configured": {
                    "openai": {
                        "set": openai_key_set,
                        "purpose": "Embeddings only (RAG system)",
                        "used_for": "Document embeddings and vector search (not changeable)"
                    },
                    "deepseek": {
                        "set": deepseek_key_set,
                        "purpose": "Default LLM (agent and RAG)",
                        "used_for": "Chat responses and agent interactions (users can change/add their own LLM)"
                    }
                },
                "today_usage": {
                    "provider": today_stats.get("llm_provider"),
                    "model": today_stats.get("llm_model"),
                    "input_tokens": today_stats.get("input_tokens", 0),
                    "output_tokens": today_stats.get("output_tokens", 0),
                    "embedding_tokens": today_stats.get("embedding_tokens", 0)
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get API keys info: {str(e)}")


@router.get("/usage/per-request")
async def get_per_request_stats(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = 7,
    group_by: str = "hour"  # "hour", "day", "minute"
):
    """
    Get per-request statistics grouped by time period
    
    Args:
        current_user: Current authenticated user (optional)
        db: Database session
        days: Number of days to retrieve (default: 7)
        group_by: Grouping period - "hour", "day", or "minute" (default: "hour")
        
    Returns:
        Per-request statistics grouped by time period
    """
    try:
        if group_by not in ["hour", "day", "minute"]:
            raise HTTPException(status_code=400, detail="group_by must be 'hour', 'day', or 'minute'")
        
        user_id = current_user.id if current_user else None
        
        stats = usage_tracker.get_per_request_stats(user_id, db, days, group_by)
        
        return {
            "status": "success",
            "data": stats
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get per-request stats: {str(e)}")


@router.get("/usage/requests")
async def get_individual_requests(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = 7,
    limit: int = 100,
    offset: int = 0
):
    """
    Get individual API requests with details
    
    Args:
        current_user: Current authenticated user (optional)
        db: Database session
        days: Number of days to retrieve (default: 7)
        limit: Maximum number of requests to return (default: 100, max: 1000)
        offset: Number of requests to skip for pagination (default: 0)
        
    Returns:
        List of individual API requests with LLM provider, model, tokens, etc.
    """
    try:
        from datetime import timedelta
        from src.core import DB_AVAILABLE
        from src.core.models import APIRequest
        
        if not DB_AVAILABLE:
            return {
                "status": "success",
                "data": {
                    "requests": [],
                    "total": 0,
                    "limit": limit,
                    "offset": offset
                }
            }
        
        user_id = current_user.id if current_user else None
        
        # Validate limit
        limit = min(max(1, limit), 1000)
        offset = max(0, offset)
        
        # Calculate start date
        from src.services.usage_tracker import UsageTracker
        today_start = UsageTracker.get_today_start()
        start_date = today_start - timedelta(days=days - 1)
        
        # Query individual requests
        query = db.query(APIRequest).filter(
            APIRequest.user_id == user_id,
            APIRequest.request_timestamp >= start_date
        )
        
        # Get total count
        total = query.count()
        
        # Get paginated results, ordered by most recent first
        requests = query.order_by(
            APIRequest.request_timestamp.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            "status": "success",
            "data": {
                "requests": [req.to_dict() for req in requests],
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get individual requests: {str(e)}")

