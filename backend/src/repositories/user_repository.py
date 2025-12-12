"""
User Repository - Repository Pattern

Standard user CRUD operations. Nothing fancy here, just
keeps database queries organized.
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from src.repositories.base_repository import BaseRepository
from src.core.models import User


class UserRepository(BaseRepository[User]):
    """
    Repository for User operations

    Basic user queries. Could add more complex queries if needed.
    """

    def __init__(self, db: Session):
        super().__init__(db, User)

    def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def find_by_auth0_id(self, auth0_id: str) -> Optional[User]:
        """Find user by Auth0 ID"""
        return self.db.query(User).filter(User.auth0_id == auth0_id).first()

    def find_active_users(self) -> List[User]:
        """Find all active users"""
        return self.db.query(User).filter(User.is_active == True).all()

    def find_inactive_users(self) -> List[User]:
        """Find all inactive users"""
        return self.db.query(User).filter(User.is_active == False).all()

    def find_by_role(self, role: str) -> List[User]:
        """Find users by role"""
        return self.db.query(User).filter(User.role == role).all()


