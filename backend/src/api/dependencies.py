"""
Common dependencies for API routes
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core import get_db, User
from src.core.auth import get_current_user, get_current_active_user
from src.utils.logger import app_logger


def get_optional_user(
    current_user: Optional[User] = Depends(get_current_user)
) -> Optional[User]:
    """Get optional authenticated user (doesn't raise if not authenticated)"""
    return current_user


def require_authentication(
    current_user: Optional[User] = Depends(get_current_user)
) -> User:
    """Require authentication - raises 401 if not authenticated"""
    if not current_user:
        app_logger.warning("Unauthenticated access attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return current_user


def get_db_session(db: Session = Depends(get_db)) -> Session:
    """Get database session with validation"""
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    return db
