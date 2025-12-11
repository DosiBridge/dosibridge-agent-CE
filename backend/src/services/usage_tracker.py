"""
API Usage Tracking Service
Tracks user API usage for monitoring and rate limiting
"""
from datetime import datetime, date, timedelta, timezone
from typing import Optional, Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from src.core import get_db_context, DB_AVAILABLE
from src.core.models import APIUsage, APIRequest, User
from src.core.constants import DAILY_REQUEST_LIMIT, DAILY_REQUEST_LIMIT_UNAUTHENTICATED


class UsageTracker:
    """Service for tracking API usage and enforcing daily limits"""
    
    @staticmethod
    def get_today_start() -> datetime:
        """Get start of today in UTC"""
        today = date.today()
        return datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    @staticmethod
    def get_client_ip(request) -> Optional[str]:
        """Get client IP address from request"""
        if not request:
            return None
        # Check for forwarded IP (when behind proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, get the first one
            return forwarded_for.split(",")[0].strip()
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        # Fallback to direct client IP
        if request.client:
            return request.client.host
        return None
    
    @staticmethod
    def check_daily_limit(user_id: Optional[int], db: Session, is_default_llm: bool = False, ip_address: Optional[str] = None, guest_email: Optional[str] = None) -> Tuple[bool, int, int]:
        """
        Check if user has exceeded daily request limit
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            is_default_llm: True if using default DeepSeek LLM, False for custom API keys (unlimited)
            ip_address: IP address for anonymous users (required when user_id is None)
            guest_email: Optional email for guest users tracking
            
        Returns:
            Tuple of (is_allowed, current_count, limit)
        """
        if not DB_AVAILABLE:
            # If database not available, allow all requests
            limit = DAILY_REQUEST_LIMIT_UNAUTHENTICATED if user_id is None else DAILY_REQUEST_LIMIT
            return True, 0, limit
        
        # If using custom API key (not default LLM), no limit
        if not is_default_llm:
            return True, 0, -1  # -1 means unlimited
        
        try:
            today_start = UsageTracker.get_today_start()
            
            # Determine the limit based on authentication status and guest email
            if user_id is None:
                # Unauthenticated user
                # If guest email provided, they get 10 requests/day (as per requirement)
                # If no email (truly anonymous), defaulting to 5 or keeping same strict limit?
                # User requirement: "without logni also user can use chat but limite par day is 10"
                # And "when a user without login to chat then for monetoing get a dialog box to get email"
                
                limit = 10 # Explicit 10/day limit for unauthenticated users
                
                if guest_email:
                     # Query by guest email
                    usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email == guest_email,
                        func.date(APIUsage.usage_date) == today_start.date()
                    ).first()
                elif ip_address:
                    # Query by IP address for anonymous users without email
                    usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email.is_(None),
                        APIUsage.ip_address == ip_address,
                        func.date(APIUsage.usage_date) == today_start.date()
                    ).first()
                else:
                    # If no IP and no email, allow but warn (shouldn't happen)
                    return True, 0, limit
            else:
                # Authenticated user - 100 requests per day
                limit = DAILY_REQUEST_LIMIT
                # Query by user_id for authenticated users
                usage = db.query(APIUsage).filter(
                    APIUsage.user_id == user_id,
                    func.date(APIUsage.usage_date) == today_start.date()
                ).first()
            
            current_count = usage.request_count if usage else 0
            is_allowed = current_count < limit
            remaining = max(0, limit - current_count)
            
            return is_allowed, current_count, remaining
        except Exception as e:
            print(f"⚠️  Error checking daily limit: {e}")
            # On error, allow the request
            limit = 10 if user_id is None else DAILY_REQUEST_LIMIT
            return True, 0, limit
    
    @staticmethod
    def record_request(
        user_id: Optional[int],
        db: Session,
        llm_provider: Optional[str] = None,
        llm_model: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        embedding_tokens: int = 0,
        mode: Optional[str] = None,
        session_id: Optional[str] = None,
        success: bool = True,
        ip_address: Optional[str] = None,
        guest_email: Optional[str] = None
    ) -> bool:
        """
        Record an API request (both daily aggregate and individual request)
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            llm_provider: LLM provider used (deepseek, openai, etc.)
            llm_model: Model name used
            input_tokens: Input tokens consumed
            output_tokens: Output tokens consumed
            embedding_tokens: Embedding tokens consumed (OpenAI)
            mode: Chat mode ("agent" or "rag")
            session_id: Session ID if available
            success: Whether the request was successful
            ip_address: Client IP
            guest_email: Optional guest email for unauthenticated users
            
        Returns:
            True if recorded successfully
        """
        if not DB_AVAILABLE:
            return False
        
        try:
            from datetime import datetime, timezone
            request_timestamp = datetime.now(timezone.utc)
            today_start = UsageTracker.get_today_start()
            total_tokens = input_tokens + output_tokens + embedding_tokens
            
            # Record individual request
            if APIRequest:
                api_request = APIRequest(
                    user_id=user_id,
                    request_timestamp=request_timestamp,
                    llm_provider=llm_provider,
                    llm_model=llm_model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    embedding_tokens=embedding_tokens,
                    total_tokens=total_tokens,
                    mode=mode,
                    session_id=session_id,
                    success=success,
                    guest_email=guest_email if user_id is None else None
                )
                db.add(api_request)
            
            # Get or create today's usage record (for daily aggregates)
            if user_id is None:
                # For unauthenticated users
                if guest_email:
                    usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email == guest_email,
                        func.date(APIUsage.usage_date) == today_start.date()
                    ).first()
                elif ip_address:
                    usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email.is_(None), # Explicitly NULL guest_email
                        APIUsage.ip_address == ip_address,
                        func.date(APIUsage.usage_date) == today_start.date()
                    ).first()
                else:
                    return False
            else:
                # For authenticated users, query by user_id
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
                    ip_address=ip_address if user_id is None else None,
                    usage_date=today_start,
                    request_count=1,
                    llm_provider=llm_provider,
                    llm_model=llm_model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    embedding_tokens=embedding_tokens,
                    mode=mode,
                    guest_email=guest_email if user_id is None else None
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
        days: int = 7,
        ip_address: Optional[str] = None,
        guest_email: Optional[str] = None
    ) -> Dict:
        """
        Get usage statistics for a user
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            db: Database session
            days: Number of days to retrieve
            ip_address: IP address for anonymous users (required when user_id is None)
            guest_email: Optional guest email for unauthenticated users
            
        Returns:
            Dictionary with usage statistics
        """
        if not DB_AVAILABLE:
            limit = DAILY_REQUEST_LIMIT_UNAUTHENTICATED if user_id is None else DAILY_REQUEST_LIMIT
            return {
                "today": {"request_count": 0, "remaining": limit},
                "recent_days": [],
                "total_requests": 0,
                "total_tokens": 0,
                "days_analyzed": days
            }
        
        try:
            today_start = UsageTracker.get_today_start()
            start_date = today_start - timedelta(days=days - 1)
            limit = DAILY_REQUEST_LIMIT_UNAUTHENTICATED if user_id is None else DAILY_REQUEST_LIMIT
            
            # Get today's usage
            # Get today's usage
            if user_id is None:
                if guest_email:
                    today_usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email == guest_email,
                        func.date(APIUsage.usage_date) == today_start.date()
                    ).first()
                    
                    recent_usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email == guest_email,
                        APIUsage.usage_date >= start_date
                    ).order_by(APIUsage.usage_date.desc()).all()
                    
                elif ip_address:
                    today_usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email.is_(None),
                        APIUsage.ip_address == ip_address,
                        func.date(APIUsage.usage_date) == today_start.date()
                    ).first()
                    
                    recent_usage = db.query(APIUsage).filter(
                        APIUsage.user_id.is_(None),
                        APIUsage.guest_email.is_(None),
                        APIUsage.ip_address == ip_address,
                        APIUsage.usage_date >= start_date
                    ).order_by(APIUsage.usage_date.desc()).all()
                else:
                    return {
                        "today": {"request_count": 0, "remaining": limit},
                        "recent_days": [],
                        "total_requests": 0,
                        "total_tokens": 0
                    }
            else:
                today_usage = db.query(APIUsage).filter(
                    APIUsage.user_id == user_id,
                    func.date(APIUsage.usage_date) == today_start.date()
                ).first()
                
                # Get recent days usage
                recent_usage = db.query(APIUsage).filter(
                    APIUsage.user_id == user_id,
                    APIUsage.usage_date >= start_date
                ).order_by(APIUsage.usage_date.desc()).all()
            
            today_count = today_usage.request_count if today_usage else 0
            today_remaining = max(0, limit - today_count)
            
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
                    "limit": limit,
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
            limit = DAILY_REQUEST_LIMIT_UNAUTHENTICATED if user_id is None else DAILY_REQUEST_LIMIT
            return {
                "today": {"request_count": 0, "remaining": limit},
                "recent_days": [],
                "total_requests": 0,
                "total_tokens": 0,
                "days_analyzed": days
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
    
    @staticmethod
    def get_per_request_stats(
        user_id: Optional[int],
        db: Session,
        days: int = 7,
        group_by: str = "hour",  # "hour", "day", "minute"
        ip_address: Optional[str] = None
    ) -> Dict:
        """
        Get per-request statistics grouped by time period
        
        Args:
            user_id: User ID (None for anonymous users)
            db: Database session
            days: Number of days to retrieve
            group_by: Grouping period ("hour", "day", "minute")
            
        Returns:
            Dictionary with per-request statistics grouped by time period
        """
        if not DB_AVAILABLE or not APIRequest:
            return {
                "requests": [],
                "total_requests": 0,
                "group_by": group_by,
                "days": days
            }
        
        try:
            from datetime import datetime, timedelta, timezone
            today_start = UsageTracker.get_today_start()
            start_date = today_start - timedelta(days=days - 1)
            
            # Get all individual requests
            if user_id is None:
                if not ip_address:
                    return {
                        "requests": [],
                        "total_requests": 0,
                        "group_by": group_by,
                        "days": days
                    }
                # For anonymous users, we need to track by IP - but APIRequest doesn't have IP field
                # For now, query all anonymous requests (user_id is None)
                # In future, we might add ip_address to APIRequest as well
                requests = db.query(APIRequest).filter(
                    APIRequest.user_id.is_(None),
                    APIRequest.request_timestamp >= start_date
                ).order_by(APIRequest.request_timestamp.asc()).all()
            else:
                requests = db.query(APIRequest).filter(
                    APIRequest.user_id == user_id,
                    APIRequest.request_timestamp >= start_date
                ).order_by(APIRequest.request_timestamp.asc()).all()
            
            # Group requests by time period
            grouped_requests = {}
            for req in requests:
                timestamp = req.request_timestamp
                
                # Group by selected period
                if group_by == "hour":
                    key = timestamp.strftime("%Y-%m-%d %H:00")
                elif group_by == "day":
                    key = timestamp.strftime("%Y-%m-%d")
                elif group_by == "minute":
                    key = timestamp.strftime("%Y-%m-%d %H:%M")
                else:
                    key = timestamp.strftime("%Y-%m-%d")
                
                if key not in grouped_requests:
                    grouped_requests[key] = {
                        "timestamp": key,
                        "request_count": 0,
                        "total_tokens": 0,
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "embedding_tokens": 0,
                        "valid_requests": 0,
                        "invalid_requests": 0,
                        "avg_tokens_per_request": 0,
                    }
                
                grouped_requests[key]["request_count"] += 1
                grouped_requests[key]["total_tokens"] += req.total_tokens
                grouped_requests[key]["input_tokens"] += req.input_tokens
                grouped_requests[key]["output_tokens"] += req.output_tokens
                grouped_requests[key]["embedding_tokens"] += req.embedding_tokens
                
                if req.success and req.total_tokens > 0:
                    grouped_requests[key]["valid_requests"] += 1
                else:
                    grouped_requests[key]["invalid_requests"] += 1
            
            # Calculate averages and format
            requests_list = []
            for key in sorted(grouped_requests.keys()):
                group = grouped_requests[key]
                if group["request_count"] > 0:
                    group["avg_tokens_per_request"] = round(
                        group["total_tokens"] / group["request_count"]
                    )
                requests_list.append(group)
            
            return {
                "requests": requests_list,
                "total_requests": len(requests),
                "group_by": group_by,
                "days": days
            }
        except Exception as e:
            print(f"⚠️  Error getting per-request stats: {e}")
            return {
                "requests": [],
                "total_requests": 0,
                "group_by": group_by,
                "days": days
            }


    @staticmethod
    def get_system_usage_history(
        db: Session,
        days: int = 7,
        group_by: str = "day"  # "hour", "day"
    ) -> Dict:
        """
        Get system-wide usage history (all users combined)
        
        Args:
            db: Database session
            days: Number of days to retrieve
            group_by: Grouping period ("hour", "day")
            
        Returns:
            Dictionary with system usage history
        """
        if not DB_AVAILABLE or not APIRequest:
            return {
                "history": [],
                "total_requests": 0,
                "days": days
            }
        
        try:
            from datetime import datetime, timedelta
            today_start = UsageTracker.get_today_start()
            start_date = today_start - timedelta(days=days - 1)
            
            # Query all requests within the time range
            requests = db.query(APIRequest).filter(
                APIRequest.request_timestamp >= start_date
            ).order_by(APIRequest.request_timestamp.asc()).all()
            
            # Group requests by time period
            grouped_data = {}
            
            # Initialize all days in range with 0 to ensure continuous chart
            for i in range(days):
                current_date = start_date + timedelta(days=i)
                date_key = current_date.strftime("%Y-%m-%d")
                grouped_data[date_key] = {
                    "date": date_key,
                    "requests": 0,
                    "tokens": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "embedding_tokens": 0,
                    "errors": 0
                }

            for req in requests:
                timestamp = req.request_timestamp
                # For now we only support daily grouping for the main chart
                key = timestamp.strftime("%Y-%m-%d")
                
                if key in grouped_data:
                    grouped_data[key]["requests"] += 1
                    grouped_data[key]["tokens"] += req.total_tokens
                    grouped_data[key]["input_tokens"] += req.input_tokens
                    grouped_data[key]["output_tokens"] += req.output_tokens
                    grouped_data[key]["embedding_tokens"] += req.embedding_tokens
                    
                    if not req.success:
                        grouped_data[key]["errors"] += 1
            
            # Convert to list and sort
            history_list = sorted(grouped_data.values(), key=lambda x: x["date"])
            
            total_requests = sum(item["requests"] for item in history_list)
            
            return {
                "history": history_list,
                "total_requests": total_requests,
                "days": days
            }
        except Exception as e:
            print(f"⚠️  Error getting system usage history: {e}")
            return {
                "history": [],
                "total_requests": 0,
                "days": days
            }


# Global instance
usage_tracker = UsageTracker()

