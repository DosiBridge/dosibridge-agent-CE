"""
LLM Configuration Management Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import os
from src.core import Config, get_db, LLMConfig, User
from src.core.auth import get_current_active_user, get_current_user
from src.services import create_llm_from_config
from ..models import LLMConfigRequest
from typing import Optional
from langchain_core.messages import HumanMessage

router = APIRouter()


async def test_llm_config(config_dict: dict) -> tuple[bool, str]:
    """
    Test LLM configuration by making a simple API call.
    
    Args:
        config_dict: LLM configuration dictionary
        
    Returns:
        Tuple of (success: bool, message: str)
        Note: Returns True for rate limit/quota errors since the API key is valid
    """
    try:
        # Create LLM instance
        llm = create_llm_from_config(config_dict, streaming=False, temperature=0)
        
        # Make a simple test call (very short prompt to minimize cost)
        test_message = HumanMessage(content="Hi")
        
        # Use async invoke if available, otherwise run sync invoke in executor
        import asyncio
        if hasattr(llm, 'ainvoke'):
            response = await llm.ainvoke([test_message])
        else:
            # Run sync invoke in executor to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: llm.invoke([test_message]))
        
        # Check if we got a response
        if response and hasattr(response, 'content') and response.content:
            return True, "LLM configuration is valid and working"
        else:
            return False, "LLM responded but with empty content"
    except ImportError as e:
        return False, f"Missing required package: {str(e)}"
    except ValueError as e:
        # ValueError can be raised by llm_factory for quota errors
        error_msg = str(e).lower()
        rate_limit_indicators = [
            "rate limit",
            "quota exceeded",
            "429",
            "quota",
            "billing",
            "plan and billing",
            "resource_exhausted"
        ]
        
        # Check if it's a rate limit/quota error
        is_rate_limit_error = any(indicator in error_msg for indicator in rate_limit_indicators)
        
        if is_rate_limit_error:
            # For rate limit errors, return success with a warning message
            # The API key is valid, just the account has hit limits
            original_error = str(e)
            return True, f"API key appears valid but account has rate limit/quota issues: {original_error}. You can still save this configuration and use it later when limits reset."
        
        # For other ValueError, return failure
        return False, str(e)
    except Exception as e:
        error_msg = str(e).lower()
        
        # Check for rate limit or quota errors - these mean the API key is valid
        # but the account has exceeded limits. We should allow saving the config.
        rate_limit_indicators = [
            "rate limit",
            "quota exceeded",
            "429",
            "quota",
            "billing",
            "plan and billing",
            "resource_exhausted"
        ]
        
        # Check if it's a rate limit/quota error
        is_rate_limit_error = any(indicator in error_msg for indicator in rate_limit_indicators)
        
        if is_rate_limit_error:
            # For rate limit errors, return success with a warning message
            # The API key is valid, just the account has hit limits
            original_error = str(e)
            return True, f"API key appears valid but account has rate limit/quota issues: {original_error}. You can still save this configuration and use it later when limits reset."
        
        # For other errors, return failure with helpful messages
        if "API key" in error_msg or "authentication" in error_msg or "401" in error_msg or "403" in error_msg:
            return False, f"Invalid API key or authentication failed: {str(e)[:200]}"
        elif "not found" in error_msg or "NotFound" in error_msg or "404" in error_msg:
            # Model not available - provide helpful suggestions
            if "gemini" in error_msg.lower():
                return False, f"Gemini model not available: {str(e)[:300]}. Try using 'gemini-1.5-pro' or 'gemini-pro' instead."
            return False, f"Model not found or not available: {str(e)[:300]}"
        elif "model" in error_msg and ("invalid" in error_msg):
            return False, f"Invalid model name: {str(e)[:200]}"
        elif "connection" in error_msg or "timeout" in error_msg or "refused" in error_msg:
            return False, f"Connection error: {str(e)[:200]}"
        else:
            return False, f"Test failed: {str(e)[:200]}"


@router.get("/llm-config")
async def get_llm_config(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current LLM configuration for the authenticated user"""
    try:
        user_id = current_user.id if current_user else None
        config = Config.load_llm_config(db=db, user_id=user_id)
        # Don't send API key in response for security
        safe_config = {k: v for k, v in config.items() if k != "api_key" or not v}
        # Include has_api_key in the config object for frontend compatibility
        safe_config["has_api_key"] = bool(config.get("api_key"))
        return {
            "status": "success",
            "config": safe_config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/llm-config")
async def set_llm_config(
    config: LLMConfigRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Set LLM configuration for the authenticated user - allows switching to any model/LLM.
    If use_default is True, switches to default DeepSeek LLM (100 requests/day limit).
    """
    try:
        user_id = current_user.id if current_user else None
        
        # If use_default is True, switch to default DeepSeek
        if config.use_default:
            # Deactivate user's existing configs
            if user_id:
                db.query(LLMConfig).filter(LLMConfig.user_id == user_id).update({LLMConfig.active: False})
            else:
                db.query(LLMConfig).filter(LLMConfig.user_id.is_(None)).update({LLMConfig.active: False})
            
            # Get or create default DeepSeek config
            deepseek_api_key = os.getenv("DEEPSEEK_KEY")
            default_config = LLMConfig(
                user_id=user_id,
                type="deepseek",
                model="deepseek-chat",
                api_key=deepseek_api_key,
                api_base="https://api.deepseek.com",
                active=True,
                is_default=True
            )
            db.add(default_config)
            db.commit()
            db.refresh(default_config)
            
            return {
                "status": "success",
                "message": "Switched to default DeepSeek LLM (100 requests/day limit)",
                "config": default_config.to_dict()
            }
        
        # Validate required fields based on type
        if config.type.lower() == "ollama":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Ollama")
            config_dict = {
                "type": "ollama",
                "model": config.model,
                "base_url": config.base_url or "http://localhost:11434",
                "active": True
            }
        elif config.type.lower() == "gemini":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Gemini")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for Gemini")
            config_dict = {
                "type": "gemini",
                "model": config.model,
                "api_key": config.api_key,
                "active": True
            }
        elif config.type.lower() == "groq":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Groq")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for Groq")
            config_dict = {
                "type": "groq",
                "model": config.model,
                "api_key": config.api_key,
                "active": True
            }
        elif config.type.lower() == "deepseek":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for DeepSeek")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for DeepSeek")
            config_dict = {
                "type": "deepseek",
                "model": config.model,
                "api_key": config.api_key,
                "api_base": config.api_base or "https://api.deepseek.com",
                "active": True,
                "is_default": False
            }
        elif config.type.lower() == "openrouter":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenRouter")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenRouter")
            config_dict = {
                "type": "openrouter",
                "model": config.model,
                "api_key": config.api_key,
                "api_base": config.api_base or "https://openrouter.ai/api/v1",
                "active": True,
                "is_default": False
            }
        else:  # OpenAI
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenAI")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenAI")
            config_dict = {
                "type": "openai",
                "model": config.model,
                "api_key": config.api_key,
                "active": True,
                "is_default": False
            }
            if config.api_base:
                config_dict["api_base"] = config.api_base
        
        # Trim model name before saving and validate
        if config_dict.get("model"):
            config_dict["model"] = config_dict["model"].strip()
        
        # Validate OpenRouter model format (should be provider/model)
        if config_dict.get("type") == "openrouter":
            model_name = config_dict.get("model", "")
            if "/" not in model_name:
                raise HTTPException(
                    status_code=400,
                    detail="OpenRouter model names must be in format 'provider/model' (e.g., 'anthropic/claude-3.7-sonnet')"
                )
        
        # TEST the configuration BEFORE saving to database
        test_success, test_message = await test_llm_config(config_dict)
        if not test_success:
            # Test failed - don't save to database
            raise HTTPException(
                status_code=400,
                detail=f"LLM configuration test failed: {test_message}. Please check your API key and model name."
            )
        
        # Test passed - proceed to save to database
        # Deactivate user's existing configs
        if user_id:
            db.query(LLMConfig).filter(LLMConfig.user_id == user_id).update({LLMConfig.active: False})
        else:
            db.query(LLMConfig).filter(LLMConfig.user_id.is_(None)).update({LLMConfig.active: False})
        
        # Create new active config for user
        llm_config = LLMConfig(
            user_id=user_id,
            type=config_dict.get("type", "openai"),
            model=config_dict.get("model", "gpt-4o"),
            api_key=config_dict.get("api_key"),
            base_url=config_dict.get("base_url"),
            api_base=config_dict.get("api_base"),
            active=True,
            is_default=config_dict.get("is_default", False)
        )
        db.add(llm_config)
        
        try:
            db.commit()
            db.refresh(llm_config)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to save LLM configuration: {str(e)}")
        
        return {
            "status": "success",
            "message": f"LLM configuration tested and saved successfully. Model: {config_dict['model']}",
            "config": llm_config.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/llm-config/test")
async def test_llm_config_endpoint(
    config: LLMConfigRequest,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Test LLM configuration without saving to database.
    Useful for validating API keys and models before saving.
    """
    try:
        # Build config dict similar to set_llm_config
        if config.type.lower() == "ollama":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Ollama")
            config_dict = {
                "type": "ollama",
                "model": config.model,
                "base_url": config.base_url or "http://localhost:11434",
            }
        elif config.type.lower() == "gemini":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Gemini")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for Gemini")
            config_dict = {
                "type": "gemini",
                "model": config.model,
                "api_key": config.api_key,
            }
        elif config.type.lower() == "groq":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Groq")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for Groq")
            config_dict = {
                "type": "groq",
                "model": config.model,
                "api_key": config.api_key,
            }
        elif config.type.lower() == "deepseek":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for DeepSeek")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for DeepSeek")
            config_dict = {
                "type": "deepseek",
                "model": config.model,
                "api_key": config.api_key,
                "api_base": config.api_base or "https://api.deepseek.com",
            }
        elif config.type.lower() == "openrouter":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenRouter")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenRouter")
            if "/" not in config.model:
                raise HTTPException(
                    status_code=400,
                    detail="OpenRouter model names must be in format 'provider/model'"
                )
            config_dict = {
                "type": "openrouter",
                "model": config.model,
                "api_key": config.api_key,
                "api_base": config.api_base or "https://openrouter.ai/api/v1",
            }
        else:  # OpenAI
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenAI")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenAI")
            config_dict = {
                "type": "openai",
                "model": config.model,
                "api_key": config.api_key,
            }
            if config.api_base:
                config_dict["api_base"] = config.api_base
        
        # Test the configuration
        test_success, test_message = await test_llm_config(config_dict)
        
        if test_success:
            return {
                "status": "success",
                "message": test_message,
                "valid": True
            }
        else:
            return {
                "status": "error",
                "message": test_message,
                "valid": False
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


@router.post("/llm-config/reset")
async def reset_llm_config(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset LLM configuration to default DeepSeek settings (deepseek-chat) for the authenticated user.
    This switches to the default LLM with 100 requests/day limit.
    Previous configs are preserved but deactivated.
    Note: No testing required for default LLM switch.
    """
    try:
        user_id = current_user.id if current_user else None
        
        # Deactivate user's existing configs
        if user_id:
            db.query(LLMConfig).filter(LLMConfig.user_id == user_id).update({LLMConfig.active: False})
        else:
            db.query(LLMConfig).filter(LLMConfig.user_id.is_(None)).update({LLMConfig.active: False})
        
        # Get or create default DeepSeek config for user
        deepseek_api_key = os.getenv("DEEPSEEK_KEY")
        existing_default = db.query(LLMConfig).filter(
            LLMConfig.user_id == user_id,
            LLMConfig.type == "deepseek",
            LLMConfig.model == "deepseek-chat",
            LLMConfig.is_default == True
        ).first()
        
        if existing_default:
            # Reactivate the existing default config
            existing_default.active = True
            if deepseek_api_key:
                existing_default.api_key = deepseek_api_key
            db.commit()
            db.refresh(existing_default)
            default_config = existing_default
        else:
            # Create new default DeepSeek config
            default_config = LLMConfig(
                user_id=user_id,
                type="deepseek",
                model="deepseek-chat",
                api_key=deepseek_api_key,
                api_base="https://api.deepseek.com",
                active=True,
                is_default=True
            )
            db.add(default_config)
            db.commit()
            db.refresh(default_config)
        
        return {
            "status": "success",
            "message": "LLM configuration reset to default DeepSeek settings (deepseek-chat) - 100 requests/day limit",
            "config": default_config.to_dict()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset LLM configuration: {str(e)}")


@router.get("/llm-config/list")
async def list_llm_configs(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all LLM configurations for the authenticated user.
    Shows user-specific configs AND global configs (user_id=None).
    Always ensures default DeepSeek config is shown (creates it if missing).
    """
    try:
        user_id = current_user.id if current_user else None
        
        from sqlalchemy import or_
        
        # Get all configs for this user AND global configs
        configs = db.query(LLMConfig).filter(
            or_(
                LLMConfig.user_id == user_id,  # User's own configs
                LLMConfig.user_id.is_(None)     # Global configs (available to all)
            )
        ).order_by(
            LLMConfig.user_id.asc(),  # User configs first, then global (None comes after)
            LLMConfig.active.desc(),
            LLMConfig.is_default.desc(),  # Default configs first
            LLMConfig.created_at.desc()
        ).all()
        
        # Check if active default DeepSeek exists (user-specific or global)
        has_active_default = any(
            config.active and config.is_default and config.type == "deepseek" 
            for config in configs
        )
        
        # If no active default DeepSeek, load config to ensure it's created in DB
        if not has_active_default and user_id is not None:
            from src.core import Config
            # This will auto-create default DeepSeek config in database if missing
            current_config = Config.load_llm_config(db=db, user_id=user_id)
            
            # Refresh configs list after potential creation
            configs = db.query(LLMConfig).filter(
                or_(
                    LLMConfig.user_id == user_id,  # User's own configs
                    LLMConfig.user_id.is_(None)     # Global configs (available to all)
                )
            ).order_by(
                LLMConfig.user_id.asc(),
                LLMConfig.active.desc(),
                LLMConfig.is_default.desc(),
                LLMConfig.created_at.desc()
            ).all()
        
        # Convert to dict and mark global configs
        config_dicts = []
        for config in configs:
            config_dict = config.to_dict(include_api_key=False)
            config_dict['user_id'] = config.user_id  # Include user_id to identify global configs
            config_dict['is_global'] = config.user_id is None  # Mark global configs
            config_dicts.append(config_dict)
        
        return {
            "status": "success",
            "configs": config_dicts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list LLM configurations: {str(e)}")


@router.put("/llm-config/{config_id}")
async def update_llm_config(
    config_id: int,
    config: LLMConfigRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing LLM configuration.
    """
    try:
        user_id = current_user.id if current_user else None
        
        # Find the config
        llm_config = db.query(LLMConfig).filter(
            LLMConfig.id == config_id,
            LLMConfig.user_id == user_id
        ).first()
        
        if not llm_config:
            raise HTTPException(status_code=404, detail="LLM configuration not found")
        
        # Prevent editing default LLM configurations
        if llm_config.is_default:
            raise HTTPException(
                status_code=403,
                detail="Cannot edit default LLM configuration. Default configurations are read-only."
            )
        
        # Use existing config values as defaults if not provided
        update_type = (config.type or llm_config.type).lower()
        update_model = config.model or llm_config.model
        update_api_key = config.api_key if config.api_key is not None else llm_config.api_key
        update_base_url = config.base_url if config.base_url is not None else llm_config.base_url
        update_api_base = config.api_base if config.api_base is not None else llm_config.api_base
        
        # Build config dict for testing (use updated values)
        if update_type == "ollama":
            config_dict = {
                "type": "ollama",
                "model": update_model,
                "base_url": update_base_url or "http://localhost:11434",
            }
        elif update_type == "gemini":
            if not update_model:
                raise HTTPException(status_code=400, detail="Model name is required for Gemini")
            if not update_api_key:
                raise HTTPException(status_code=400, detail="API key is required for Gemini")
            config_dict = {
                "type": "gemini",
                "model": update_model,
                "api_key": update_api_key,
            }
        elif update_type == "groq":
            if not update_model:
                raise HTTPException(status_code=400, detail="Model name is required for Groq")
            if not update_api_key:
                raise HTTPException(status_code=400, detail="API key is required for Groq")
            config_dict = {
                "type": "groq",
                "model": update_model,
                "api_key": update_api_key,
            }
        elif update_type == "deepseek":
            if not update_model:
                raise HTTPException(status_code=400, detail="Model name is required for DeepSeek")
            if not update_api_key:
                raise HTTPException(status_code=400, detail="API key is required for DeepSeek")
            config_dict = {
                "type": "deepseek",
                "model": update_model,
                "api_key": update_api_key,
                "api_base": update_api_base or "https://api.deepseek.com",
            }
        elif update_type == "openrouter":
            if not update_model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenRouter")
            if not update_api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenRouter")
            if "/" not in update_model:
                raise HTTPException(
                    status_code=400,
                    detail="OpenRouter model names must be in format 'provider/model'"
                )
            config_dict = {
                "type": "openrouter",
                "model": update_model,
                "api_key": update_api_key,
                "api_base": update_api_base or "https://openrouter.ai/api/v1",
            }
        else:  # OpenAI
            if not update_model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenAI")
            if not update_api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenAI")
            config_dict = {
                "type": "openai",
                "model": update_model,
                "api_key": update_api_key,
            }
            if update_api_base:
                config_dict["api_base"] = update_api_base
        
        # Test the configuration if API key or model changed
        if (config.api_key is not None and config.api_key != llm_config.api_key) or (config.model and config.model != llm_config.model):
            test_success, test_message = await test_llm_config(config_dict)
            if not test_success:
                raise HTTPException(status_code=400, detail=f"LLM configuration test failed: {test_message}")
        
        # Update the config with new values
        llm_config.type = update_type
        llm_config.model = update_model
        if config.api_key is not None:
            llm_config.api_key = update_api_key
        if config.base_url is not None:
            llm_config.base_url = update_base_url
        if config.api_base is not None:
            llm_config.api_base = update_api_base
        
        db.commit()
        db.refresh(llm_config)
        
        return {
            "status": "success",
            "message": "LLM configuration updated successfully",
            "config": llm_config.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update LLM configuration: {str(e)}")


@router.delete("/llm-config/{config_id}")
async def delete_llm_config(
    config_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an LLM configuration.
    Cannot delete the active configuration - must switch first.
    """
    try:
        user_id = current_user.id if current_user else None
        
        # Find the config
        llm_config = db.query(LLMConfig).filter(
            LLMConfig.id == config_id,
            LLMConfig.user_id == user_id
        ).first()
        
        if not llm_config:
            raise HTTPException(status_code=404, detail="LLM configuration not found")
        
        # Prevent deleting active config
        if llm_config.active:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete active configuration. Please switch to another LLM first."
            )
        
        db.delete(llm_config)
        db.commit()
        
        return {
            "status": "success",
            "message": "LLM configuration deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete LLM configuration: {str(e)}")


@router.post("/llm-config/{config_id}/switch")
async def switch_llm_config(
    config_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Switch to/activate a specific LLM configuration.
    Users can switch to their own configs OR global configs (user_id=None).
    When switching to a global config, deactivates user's personal configs.
    When switching to a user config, deactivates other user configs.
    """
    try:
        user_id = current_user.id if current_user else None
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        from sqlalchemy import or_
        
        # Find the config - can be user-specific OR global
        llm_config = db.query(LLMConfig).filter(
            LLMConfig.id == config_id,
            or_(
                LLMConfig.user_id == user_id,  # User's own config
                LLMConfig.user_id.is_(None)     # Global config (available to all)
            )
        ).first()
        
        if not llm_config:
            raise HTTPException(status_code=404, detail="LLM configuration not found or not accessible")
        
        # If switching to a global config, deactivate all user's personal configs
        # If switching to a user config, deactivate all other user configs
        if llm_config.user_id is None:
            # Switching to global config - deactivate user's personal configs
            db.query(LLMConfig).filter(LLMConfig.user_id == user_id).update({LLMConfig.active: False})
            # Note: Global configs remain active for all users, we just deactivate user's personal ones
            # The system will automatically use the global config when no user config is active
        else:
            # Switching to user's own config - deactivate other user configs
            db.query(LLMConfig).filter(LLMConfig.user_id == user_id).update({LLMConfig.active: False})
            # Activate the selected user config
            llm_config.active = True
        
        db.commit()
        db.refresh(llm_config)
        
        config_type = "global" if llm_config.user_id is None else "personal"
        return {
            "status": "success",
            "message": f"Switched to {config_type} {llm_config.type} - {llm_config.model}",
            "config": llm_config.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to switch LLM configuration: {str(e)}")

