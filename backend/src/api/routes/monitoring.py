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
        
        is_allowed, current_count, remaining = usage_tracker.check_daily_limit(user_id, db)
        
        stats = usage_tracker.get_user_usage_stats(user_id, db, days=1)
        today_stats = stats.get("today", {})
        
        return {
            "status": "success",
            "data": {
                "request_count": current_count,
                "remaining": remaining,
                "limit": DAILY_REQUEST_LIMIT,
                "is_allowed": is_allowed,
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
        openai_key_set = bool(os.getenv("OPENAI_API_KEY"))
        deepseek_key_set = bool(os.getenv("DEEPSEEK_KEY"))
        google_key_set = bool(os.getenv("GOOGLE_API_KEY"))
        groq_key_set = bool(os.getenv("GROQ_API_KEY"))
        
        return {
            "status": "success",
            "data": {
                "active_provider": llm_config.get("type"),
                "active_model": llm_config.get("model"),
                "keys_configured": {
                    "openai": {
                        "set": openai_key_set,
                        "purpose": "Embeddings only (RAG system)",
                        "used_for": "Document embeddings and vector search"
                    },
                    "deepseek": {
                        "set": deepseek_key_set,
                        "purpose": "LLM responses (agent and RAG)",
                        "used_for": "Chat responses and agent interactions"
                    },
                    "google": {
                        "set": google_key_set,
                        "purpose": "Gemini models (optional)",
                        "used_for": "Alternative LLM provider"
                    },
                    "groq": {
                        "set": groq_key_set,
                        "purpose": "Groq models (optional)",
                        "used_for": "Alternative LLM provider"
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

