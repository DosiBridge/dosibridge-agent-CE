"""
Lifespan management for FastAPI app
"""
import asyncio
import contextlib
import os
from sqlalchemy import and_, not_
from fastapi import FastAPI
from src.core import get_db_context, DB_AVAILABLE, init_db, LLMConfig
from src.core.env_validation import validate_and_exit_on_error
from src.mcp import MCP_SERVERS
from src.utils import suppress_mcp_cleanup_errors


@contextlib.asynccontextmanager
async def mcp_lifespan(app: FastAPI):
    """Lifespan context manager for MCP servers"""
    # Validate environment variables on startup
    validate_and_exit_on_error()
    
    # Initialize database on startup
    try:
        init_db()
        print("✓ Database initialized")
        
        # Ensure primary LLM model (gpt-4o) exists - always check and create if needed
        try:
            if DB_AVAILABLE:
                openai_api_key = os.getenv("OPENAI_API_KEY")
                
                with get_db_context() as db:
                    # Check if primary gpt-4o config exists (system-wide, user_id is NULL)
                    primary_config = db.query(LLMConfig).filter(
                        LLMConfig.type == "openai",
                        LLMConfig.model == "gpt-4o",
                        LLMConfig.user_id == None  # System-wide config
                    ).first()
                    
                    if primary_config:
                        # Primary model exists - update API key from environment if provided
                        if openai_api_key:
                            primary_config.api_key = openai_api_key
                        # Ensure it's active (primary model should always be available)
                        if not primary_config.active:
                            primary_config.active = True
                            print("✓ Reactivated primary LLM model (gpt-4o)")
                        db.commit()
                        if openai_api_key:
                            print("✓ Primary LLM model (gpt-4o) exists and is active")
                        else:
                            print("⚠️  Primary LLM model (gpt-4o) exists, but OPENAI_API_KEY is not set in environment")
                    else:
                        # Primary model doesn't exist - create it (system-wide, no user_id)
                        primary_config = LLMConfig(
                            type="openai",
                            model="gpt-4o",
                            api_key=openai_api_key,  # Get from environment (may be None)
                            active=True,
                            user_id=None  # System-wide config, no user_id
                        )
                        db.add(primary_config)
                        try:
                            db.commit()
                        except Exception as commit_error:
                            # If commit fails due to NOT NULL constraint, try to fix the schema
                            db.rollback()
                            print(f"⚠️  Failed to create primary config: {commit_error}")
                            print("   Attempting to fix database schema...")
                            # The init_db() migration should handle this, but if it didn't, we'll skip
                            raise
                        if openai_api_key:
                            print("✓ Created primary LLM model (gpt-4o) with API key from environment")
                        else:
                            print("⚠️  Created primary LLM model (gpt-4o), but OPENAI_API_KEY is not set in environment")
                            print("   Please set OPENAI_API_KEY environment variable or configure API key in settings")
                    
                    # Ensure primary model is the only active one (deactivate others if primary exists)
                    other_active = db.query(LLMConfig).filter(
                        LLMConfig.active == True
                    ).filter(
                        not_(and_(LLMConfig.type == "openai", LLMConfig.model == "gpt-4o"))
                    ).all()
                    
                    if other_active and primary_config:
                        for config in other_active:
                            config.active = False
                        db.commit()
                        if other_active:
                            print(f"✓ Deactivated {len(other_active)} other LLM config(s) - gpt-4o is now primary")
        except Exception as e:
            print(f"⚠️  Could not ensure primary LLM model (gpt-4o) exists: {e}")
            import traceback
            traceback.print_exc()
    except Exception as e:
        print(f"⚠️  Failed to initialize database: {e}")
    
    # Set up exception handler to suppress MCP cleanup errors
    try:
        loop = asyncio.get_running_loop()
        loop.set_exception_handler(suppress_mcp_cleanup_errors)
    except Exception:
        # If we can't set the handler, that's okay - errors will still be logged
        pass
    
    async with contextlib.AsyncExitStack() as stack:
        # Enter all MCP server session managers
        for server in MCP_SERVERS.values():
            if hasattr(server, 'session_manager'):
                await stack.enter_async_context(server.session_manager.run())
        yield

