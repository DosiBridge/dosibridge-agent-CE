"""
Authentication and authorization utilities
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from starlette.requests import Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

import httpx

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.core.auth0 import verify_auth0_token
# from sqlalchemy.orm import Session # Already imported

# Reusable security scheme
security = HTTPBearer(auto_error=False)

from async_lru import alru_cache

@alru_cache(maxsize=1000, ttl=300)
async def get_auth0_user_info(domain: str, token: str):
    """Fetch user info from Auth0 with caching (TTL 5 mins)"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://{domain}/userinfo",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch user info from Auth0")
        return response.json()

async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Returns the current user if authenticated, or None if not.
    Does not raise 401 for missing credentials.
    """
    if not credentials:
        return None
    return await get_current_user(request, credentials, db)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates Auth0 token and returns the local User object.
    Creates the user if they don't exist (JIT Provisioning).
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = verify_auth0_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user info from Auth0 claims
    email = payload.get("email")
    name = payload.get("name")

    # If email is missing from Access Token (common), fetch from /userinfo
    # We use a cached function to avoid hitting Auth0 API on every request
    user_data = None
    if not email:
        try:
            user_data = await get_auth0_user_info(os.getenv('AUTH0_DOMAIN'), token)
            email = user_data.get("email")
            name = user_data.get("name", name)
        except Exception as e:
            # If fetch fails (timeout/error), and we still have no email, we can't identify the user
            print(f"⚠️ Auth0 UserInfo fetch failed: {e}")
            raise HTTPException(status_code=401, detail="Could not validate user identity")

    if not email:
         raise HTTPException(status_code=401, detail="Email not found in token or userinfo")

    # Extract picture - try user_data first (more detailed), then payload
    picture = None
    if user_data:
        picture = user_data.get("picture")
    if not picture:
        picture = payload.get("picture")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        # JIT Provisioning
        user = User(
            email=email,
            name=name or email.split("@")[0],
            role="user",
            picture=picture,
            is_active=True,
            hashed_password=None  # Auth0 users have no local password
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update existing user info if changed
        updates_needed = False
        if picture and user.picture != picture:
            user.picture = picture
            updates_needed = True

        # Also update name if we have a better one and it's currently default/empty
        if name and (not user.name or user.name == user.email.split("@")[0]) and name != user.name:
             user.name = name
             updates_needed = True

        if updates_needed:
            db.commit()
            db.refresh(user)

    return user


async def get_current_active_user(
    current_user: Optional[User] = Depends(get_current_user)
) -> User:
    """Get the current active user (requires authentication)"""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    return current_user
