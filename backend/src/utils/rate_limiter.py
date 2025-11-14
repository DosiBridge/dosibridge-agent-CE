"""
Rate limiting utilities
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import time


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_allowed(
        self,
        key: str,
        max_requests: int = 10,
        window_seconds: int = 60
    ) -> Tuple[bool, int]:
        """
        Check if request is allowed
        
        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if req_time > window_start
        ]
        
        # Check limit
        if len(self.requests[key]) >= max_requests:
            return False, 0
        
        # Add current request
        self.requests[key].append(now)
        
        remaining = max_requests - len(self.requests[key])
        return True, remaining
    
    def reset(self, key: str):
        """Reset rate limit for a key"""
        if key in self.requests:
            del self.requests[key]
    
    def clear(self):
        """Clear all rate limits"""
        self.requests.clear()


# Global rate limiter instance
rate_limiter = RateLimiter()

