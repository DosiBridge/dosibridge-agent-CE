"""
FastAPI dependencies for dependency injection
"""
from typing import Optional
from fastapi import Depends
from sqlalchemy.orm import Session

from src.core import get_db, User
from src.core.auth import get_current_user


def get_user_id(current_user: Optional[User] = Depends(get_current_user)) -> Optional[int]:
    """
    Extract user ID from current user.
    Returns None if user is not authenticated.
    """
    return current_user.id if current_user else None


def get_db_session(db: Session = Depends(get_db)) -> Session:
    """Get database session (alias for clarity)"""
    return db

