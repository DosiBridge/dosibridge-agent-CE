"""
Simple in-memory cache with TTL
"""
from typing import Optional, TypeVar, Callable
from datetime import datetime, timedelta
import time

T = TypeVar('T')


class Cache:
    """Simple in-memory cache with expiration"""
    
    def __init__(self, default_ttl_seconds: int = 300):
        self._cache: dict = {}
        self.default_ttl = default_ttl_seconds
    
    def get(self, key: str) -> Optional[any]:
        """Get value from cache"""
        if key not in self._cache:
            return None
        
        entry = self._cache[key]
        if time.time() > entry['expires_at']:
            del self._cache[key]
            return None
        
        return entry['value']
    
    def set(self, key: str, value: any, ttl_seconds: Optional[int] = None):
        """Set value in cache"""
        ttl = ttl_seconds or self.default_ttl
        self._cache[key] = {
            'value': value,
            'expires_at': time.time() + ttl
        }
    
    def delete(self, key: str):
        """Delete key from cache"""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Clear all cache"""
        self._cache.clear()
    
    def has(self, key: str) -> bool:
        """Check if key exists and is not expired"""
        return self.get(key) is not None


# Global cache instance
cache = Cache()

