"""
Authentication routes (Profile, Logout)
Note: Login/Register is handled by Auth0 on the frontend.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from src.core import User
from src.core.auth import get_current_user, get_current_active_user

router = APIRouter()

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    is_active: bool
    role: Optional[str] = None
    picture: Optional[str] = None

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information.
    This also triggers JIT provisioning if the user is logging in for the first time
    and calling this endpoint.
    Returns user info even if blocked (is_active=False) so blocked users can see their status
    and send appeals to superadmin.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        role=current_user.role,
        picture=getattr(current_user, 'picture', None)
    )

@router.post("/logout")
async def logout():
    """
    Logout endpoint.
    For stateless JWTs (Auth0), actual logout happens on client/Auth0 side.
    This is just a placeholder or could clear server-side cookies if used.
    """
    return {"message": "Logged out successfully"}
