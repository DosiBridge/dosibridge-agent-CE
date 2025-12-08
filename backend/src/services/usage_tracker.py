"""
API Usage Tracking Service
Tracks user API usage for monitoring and rate limiting
"""
from datetime import datetime, date, timedelta, timezone
from typing import Optional, Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from src.core import get_db_context, DB_AVAILABLE
from src.core.models import APIUsage, User
from src.core.constants import DAILY_REQUEST_LIMIT


class UsageTracker:
    """Service for tracking API usage and enforcing daily limits"""
    
    @staticmethod
    def get_today_start() -> datetime:
        """Get start of today in UTC"""
        today = date.today()
        return datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    @staticmethod
    def check_daily_limit(user_id: Optional[int], db: Session) -> Tuple[bool, int, int]:
        """
        Check if user has exceeded daily request limit
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            
        Returns:
            Tuple of (is_allowed, current_count, limit)
        """
        if not DB_AVAILABLE:
            # If database not available, allow all requests
            return True, 0, DAILY_REQUEST_LIMIT
        
        try:
            today_start = UsageTracker.get_today_start()
            
            # Get today's usage
            usage = db.query(APIUsage).filter(
                APIUsage.user_id == user_id,
                func.date(APIUsage.usage_date) == today_start.date()
            ).first()
            
            current_count = usage.request_count if usage else 0
            is_allowed = current_count < DAILY_REQUEST_LIMIT
            remaining = max(0, DAILY_REQUEST_LIMIT - current_count)
            
            return is_allowed, current_count, remaining
        except Exception as e:
            print(f"⚠️  Error checking daily limit: {e}")
            # On error, allow the request
            return True, 0, DAILY_REQUEST_LIMIT
    
    @staticmethod
    def record_request(
        user_id: Optional[int],
        db: Session,
        llm_provider: Optional[str] = None,
        llm_model: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        embedding_tokens: int = 0,
        mode: Optional[str] = None
    ) -> bool:
        """
        Record an API request
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            llm_provider: LLM provider used (deepseek, openai, etc.)
            llm_model: Model name used
            input_tokens: Input tokens consumed
            output_tokens: Output tokens consumed
            embedding_tokens: Embedding tokens consumed (OpenAI)
            mode: Chat mode ("agent" or "rag")
            
        Returns:
            True if recorded successfully
        """
        if not DB_AVAILABLE:
            return False
        
        try:
            today_start = UsageTracker.get_today_start()
            
            # Get or create today's usage record
            usage = db.query(APIUsage).filter(
                APIUsage.user_id == user_id,
                func.date(APIUsage.usage_date) == today_start.date()
            ).first()
            
            if usage:
                # Update existing record
                usage.request_count += 1
                usage.input_tokens += input_tokens
                usage.output_tokens += output_tokens
                usage.embedding_tokens += embedding_tokens
                if llm_provider:
                    usage.llm_provider = llm_provider
                if llm_model:
                    usage.llm_model = llm_model
                if mode:
                    usage.mode = mode
            else:
                # Create new record
                usage = APIUsage(
                    user_id=user_id,
                    usage_date=today_start,
                    request_count=1,
                    llm_provider=llm_provider,
                    llm_model=llm_model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    embedding_tokens=embedding_tokens,
                    mode=mode
                )
                db.add(usage)
            
            db.commit()
            return True
        except Exception as e:
            print(f"⚠️  Error recording usage: {e}")
            db.rollback()
            return False
    
    @staticmethod
    def get_user_usage_stats(
        user_id: Optional[int],
        db: Session,
        days: int = 7
    ) -> Dict:
        """
        Get usage statistics for a user
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            days: Number of days to retrieve
            
        Returns:
            Dictionary with usage statistics
        """
        if not DB_AVAILABLE:
            return {
                "today": {"request_count": 0, "remaining": DAILY_REQUEST_LIMIT},
                "recent_days": [],
                "total_requests": 0,
                "total_tokens": 0
            }
        
        try:
            today_start = UsageTracker.get_today_start()
            start_date = today_start - timedelta(days=days - 1)
            
            # Get today's usage
            today_usage = db.query(APIUsage).filter(
                APIUsage.user_id == user_id,
                func.date(APIUsage.usage_date) == today_start.date()
            ).first()
            
            today_count = today_usage.request_count if today_usage else 0
            today_remaining = max(0, DAILY_REQUEST_LIMIT - today_count)
            
            # Get recent days usage
            recent_usage = db.query(APIUsage).filter(
                APIUsage.user_id == user_id,
                APIUsage.usage_date >= start_date
            ).order_by(APIUsage.usage_date.desc()).all()
            
            recent_days = [usage.to_dict() for usage in recent_usage]
            
            # Calculate totals
            total_requests = sum(u.request_count for u in recent_usage)
            total_tokens = sum(
                u.input_tokens + u.output_tokens + u.embedding_tokens
                for u in recent_usage
            )
            
            return {
                "today": {
                    "request_count": today_count,
                    "remaining": today_remaining,
                    "limit": DAILY_REQUEST_LIMIT,
                    "input_tokens": today_usage.input_tokens if today_usage else 0,
                    "output_tokens": today_usage.output_tokens if today_usage else 0,
                    "embedding_tokens": today_usage.embedding_tokens if today_usage else 0,
                    "llm_provider": today_usage.llm_provider if today_usage else None,
                    "llm_model": today_usage.llm_model if today_usage else None,
                },
                "recent_days": recent_days,
                "total_requests": total_requests,
                "total_tokens": total_tokens,
                "days_analyzed": days
            }
        except Exception as e:
            print(f"⚠️  Error getting usage stats: {e}")
            return {
                "today": {"request_count": 0, "remaining": DAILY_REQUEST_LIMIT},
                "recent_days": [],
                "total_requests": 0,
                "total_tokens": 0
            }
    
    @staticmethod
    def get_all_users_usage_stats(db: Session, days: int = 7) -> List[Dict]:
        """
        Get usage statistics for all users (admin function)
        
        Args:
            db: Database session
            days: Number of days to retrieve
            
        Returns:
            List of user usage statistics
        """
        if not DB_AVAILABLE:
            return []
        
        try:
            today_start = UsageTracker.get_today_start()
            start_date = today_start - timedelta(days=days - 1)
            
            # Get all users with usage in the period
            users_with_usage = db.query(User).join(APIUsage).filter(
                APIUsage.usage_date >= start_date
            ).distinct().all()
            
            stats = []
            for user in users_with_usage:
                user_stats = UsageTracker.get_user_usage_stats(user.id, db, days)
                user_stats["user"] = user.to_dict()
                stats.append(user_stats)
            
            return stats
        except Exception as e:
            print(f"⚠️  Error getting all users usage stats: {e}")
            return []


# Global instance
usage_tracker = UsageTracker()

