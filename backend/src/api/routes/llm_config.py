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
        return False, str(e)
    except Exception as e:
        error_msg = str(e)
        # Provide more helpful error messages
        if "API key" in error_msg.lower() or "authentication" in error_msg.lower() or "401" in error_msg or "403" in error_msg:
            return False, f"Invalid API key or authentication failed: {error_msg[:200]}"
        elif "model" in error_msg.lower() and ("not found" in error_msg.lower() or "invalid" in error_msg.lower() or "404" in error_msg):
            return False, f"Invalid model name: {error_msg[:200]}"
        elif "connection" in error_msg.lower() or "timeout" in error_msg.lower() or "refused" in error_msg.lower():
            return False, f"Connection error: {error_msg[:200]}"
        elif "quota" in error_msg.lower() or "429" in error_msg or "rate limit" in error_msg.lower():
            return False, f"Rate limit or quota exceeded: {error_msg[:200]}"
        else:
            return False, f"Test failed: {error_msg[:200]}"


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

