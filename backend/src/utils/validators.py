"""
Additional validation utilities
"""
import re
from typing import Optional
from urllib.parse import urlparse


def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_url(url: str) -> bool:
    """Validate URL format"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def sanitize_input(text: str, max_length: Optional[int] = None) -> str:
    """Sanitize user input"""
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Trim whitespace
    text = text.strip()
    
    # Limit length
    if max_length:
        text = text[:max_length]
    
    return text


def validate_session_id(session_id: str) -> bool:
    """Validate session ID format"""
    # Allow alphanumeric, hyphens, underscores, and dots
    pattern = r'^[a-zA-Z0-9._-]+$'
    return bool(re.match(pattern, session_id)) and len(session_id) <= 255

