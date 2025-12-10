"""
Lifespan management for FastAPI app
"""
import asyncio
import contextlib
import os
from sqlalchemy import and_, not_
from fastapi import FastAPI
from src.core import get_db_context, DB_AVAILABLE, init_db, LLMConfig
from src.core.models import User, EmbeddingConfig, MCPServer
from src.core.env_validation import validate_and_exit_on_error
from src.core.auth import get_password_hash
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
        
        # First-time initialization: Ensure superadmin exists, then create default configs
        # All global configs are owned by superadmin (user_id=1)
        try:
            if DB_AVAILABLE:
                with get_db_context() as db:
                    # Step 1: Ensure superadmin exists with ID=1
                    superadmin_email = os.getenv("SUPERADMIN_EMAIL", "super@mail.com")
                    superadmin_password = os.getenv("SUPERADMIN_PASSWORD", "sparrow")
                    
                    superadmin = db.query(User).filter(User.id == 1).first()
                    if not superadmin:
                        # Check if superadmin exists with different ID
                        existing_superadmin = db.query(User).filter(
                            User.email == superadmin_email,
                            User.role == "superadmin"
                        ).first()
                        
                        if existing_superadmin:
                            print(f"⚠️  Superadmin exists with ID={existing_superadmin.id}, but ID=1 is required.")
                            print(f"   Please manually update user ID={existing_superadmin.id} to ID=1.")
                        else:
                            # Create superadmin with ID=1
                            hashed_password = get_password_hash(superadmin_password)
                            superadmin = User(
                                id=1,  # Explicitly set ID=1
                                email=superadmin_email,
                                name="Super Admin",
                                hashed_password=hashed_password,
                                is_active=True,
                                role="superadmin"
                            )
                            db.add(superadmin)
                            try:
                                db.commit()
                                db.refresh(superadmin)
                                print(f"✓ Created superadmin (ID=1) from environment variables")
                            except Exception as e:
                                db.rollback()
                                # If explicit ID fails, try without ID and update sequence
                                print(f"⚠️  Could not create superadmin with ID=1: {e}")
                                print("   Attempting without explicit ID...")
                                superadmin = User(
                                    email=superadmin_email,
                                    name="Super Admin",
                                    hashed_password=hashed_password,
                                    is_active=True,
                                    role="superadmin"
                                )
                                db.add(superadmin)
                                db.commit()
                                db.refresh(superadmin)
                                if superadmin.id != 1:
                                    print(f"⚠️  WARNING: Superadmin created with ID={superadmin.id}, not 1")
                    else:
                        # Ensure existing superadmin has correct role
                        if not hasattr(superadmin, 'role') or superadmin.role != "superadmin":
                            superadmin.role = "superadmin"
                            superadmin.is_active = True
                            db.commit()
                            print(f"✓ Updated user ID=1 to superadmin role")
                        else:
                            print(f"✓ Superadmin (ID=1) exists: {superadmin.email}")
                    
                    # Get superadmin ID (should be 1)
                    superadmin_id = superadmin.id if superadmin else None
                    if superadmin_id != 1:
                        print(f"⚠️  WARNING: Superadmin ID is {superadmin_id}, not 1. Global configs may not work correctly.")
                    
                    # Step 2: Check if any global configs exist (user_id=1 or user_id=None for backward compatibility)
                    global_llm_count = db.query(LLMConfig).filter(
                        (LLMConfig.user_id == 1) | (LLMConfig.user_id == None)
                    ).count()
                    global_embedding_count = db.query(EmbeddingConfig).filter(
                        (EmbeddingConfig.user_id == 1) | (EmbeddingConfig.user_id == None)
                    ).count()
                    
                    if global_llm_count == 0 and superadmin_id:
                        # First-time initialization: Create default LLM config from environment
                        print("ℹ️  No global LLM configs found. Initializing from environment variables...")
                        
                        deepseek_api_key = os.getenv("DEEPSEEK_KEY")
                        if deepseek_api_key:
                            from src.utils.encryption import encrypt_value
                            default_llm_config = LLMConfig(
                                user_id=superadmin_id,  # Owned by superadmin
                                type="deepseek",
                                model="deepseek-chat",
                                api_key=encrypt_value(deepseek_api_key),
                                api_base="https://api.deepseek.com",
                                active=True,
                                is_default=True  # Set as default for first init
                            )
                            db.add(default_llm_config)
                            try:
                                db.commit()
                                db.refresh(default_llm_config)
                                print(f"✓ Created default global LLM config (owned by superadmin ID={superadmin_id}): DeepSeek (deepseek-chat)")
                            except Exception as commit_error:
                                db.rollback()
                                print(f"⚠️  Failed to create default LLM config: {commit_error}")
                        else:
                            print("⚠️  DEEPSEEK_KEY not set. Please configure LLM providers via the superadmin dashboard.")
                    
                    if global_embedding_count == 0 and superadmin_id:
                        # First-time initialization: Create default embedding config from environment
                        print("ℹ️  No global embedding configs found. Initializing from environment variables...")
                        
                        openai_api_key = os.getenv("OPENAI_API_KEY")
                        if openai_api_key:
                            from src.utils.encryption import encrypt_value
                            default_embedding_config = EmbeddingConfig(
                                user_id=superadmin_id,  # Owned by superadmin
                                provider="openai",
                                model="text-embedding-3-small",
                                api_key=encrypt_value(openai_api_key),
                                active=True,
                                is_default=True  # Set as default for first init
                            )
                            db.add(default_embedding_config)
                            try:
                                db.commit()
                                db.refresh(default_embedding_config)
                                print(f"✓ Created default global embedding config (owned by superadmin ID={superadmin_id}): OpenAI (text-embedding-3-small)")
                            except Exception as commit_error:
                                db.rollback()
                                print(f"⚠️  Failed to create default embedding config: {commit_error}")
                        else:
                            print("⚠️  OPENAI_API_KEY not set. Please configure embedding providers via the superadmin dashboard.")
                    
                    # Step 3: Check status of existing configs
                    if global_llm_count > 0:
                        active_default_llm = db.query(LLMConfig).filter(
                            ((LLMConfig.user_id == 1) | (LLMConfig.user_id == None)),
                            LLMConfig.active == True,
                            LLMConfig.is_default == True
                        ).count()
                        if active_default_llm == 0:
                            print("⚠️  No active default global LLM config found. Users may not be able to use LLM features.")
                        else:
                            print(f"✓ Found {global_llm_count} global LLM config(s), {active_default_llm} active default(s)")
                    
                    if global_embedding_count > 0:
                        active_default_embedding = db.query(EmbeddingConfig).filter(
                            ((EmbeddingConfig.user_id == 1) | (EmbeddingConfig.user_id == None)),
                            EmbeddingConfig.active == True,
                            EmbeddingConfig.is_default == True
                        ).count()
                        if active_default_embedding == 0:
                            print("⚠️  No active default global embedding config found.")
                        else:
                            print(f"✓ Found {global_embedding_count} global embedding config(s), {active_default_embedding} active default(s)")
                    
                    print("   All global configs are managed via the superadmin dashboard.")
        except Exception as e:
            print(f"⚠️  Could not initialize global configs: {e}")
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

