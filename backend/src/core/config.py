"""
Configuration and environment management
Now uses PostgreSQL database instead of JSON files
"""
import os
import json
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not available, using environment variables directly")

# Import database models
try:
    from .database import get_db_context, DB_AVAILABLE as DB_AVAILABLE_FLAG
    if DB_AVAILABLE_FLAG:
        from .models import LLMConfig, MCPServer
        DB_AVAILABLE = True
    else:
        DB_AVAILABLE = False
        LLMConfig = None  # type: ignore
        MCPServer = None  # type: ignore
        print("⚠️  Database not available, falling back to JSON files")
except ImportError as e:
    print(f"⚠️  Database not available: {e}, falling back to JSON files")
    DB_AVAILABLE = False
    get_db_context = None  # type: ignore
    LLMConfig = None  # type: ignore
    MCPServer = None  # type: ignore


class Config:
    """Application configuration"""
    
    # OpenAI settings (deprecated - use LLM config file)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
    
    # MCP settings
    MCP_SERVERS_FILE = "config/mcp_servers.json"
    MCP_SERVERS_ENV = os.getenv("MCP_SERVERS")
    
    # LLM settings
    LLM_CONFIG_FILE = "config/llm_config.json"
    
    # Project root
    ROOT_DIR = Path(__file__).parent.parent
    
    @classmethod
    def load_mcp_servers(cls, additional_servers: list = None, db: Optional[Session] = None, user_id: Optional[int] = None) -> list[dict]:
        """
        Load MCP servers from database - USER-SPECIFIC AND PRIVATE ONLY.
        
        Args:
            additional_servers: Optional list of additional servers to add (must also be user-specific)
            db: Optional database session (if None, creates a new one)
            user_id: User ID to filter servers (REQUIRED - no MCP access without authentication)
        
        Returns:
            List of MCP server configurations for the specified user only
            
        Note:
            - Without user_id, returns empty list (no MCP access for unauthenticated users)
            - No environment variable fallback (all MCPs must be user-specific and private)
            - All MCP servers are private to the user who created them
            - Users can only access their own MCP servers, not others
        """
        servers = []
        
        # REQUIRE user_id - no MCP access without authentication
        if user_id is None:
            print("⚠️  MCP servers require authentication - user_id is required. No MCP access for unauthenticated users.")
            return []
        
        # Load from database - user-specific servers AND global servers (user_id=None)
        if DB_AVAILABLE:
            try:
                if db:
                    # Use provided session - get user-specific AND global servers
                    from sqlalchemy import or_
                    query = db.query(MCPServer).filter(
                        MCPServer.enabled == True,
                        or_(
                            MCPServer.user_id == user_id,  # User's own servers
                            MCPServer.user_id.is_(None)     # Global servers (available to all)
                        )
                    )
                    db_servers = query.all()
                    servers = [s.to_dict(include_api_key=True) for s in db_servers]
                    # Mark global servers
                    for server in servers:
                        server['is_global'] = db_servers[servers.index(server)].user_id is None
                else:
                    # Create new session - get user-specific AND global servers
                    with get_db_context() as session:
                        from sqlalchemy import or_
                        query = session.query(MCPServer).filter(
                            MCPServer.enabled == True,
                            or_(
                                MCPServer.user_id == user_id,  # User's own servers
                                MCPServer.user_id.is_(None)     # Global servers (available to all)
                            )
                        )
                        db_servers = query.all()
                        servers = [s.to_dict(include_api_key=True) for s in db_servers]
                        # Mark global servers
                        for server in servers:
                            server['is_global'] = db_servers[servers.index(server)].user_id is None
                
                user_servers = [s for s in servers if not s.get('is_global')]
                global_servers = [s for s in servers if s.get('is_global')]
                if servers:
                    print(f"📝 Loaded {len(user_servers)} user-specific + {len(global_servers)} global MCP server(s) for user {user_id}")
            except Exception as e:
                print(f"⚠️  Failed to load MCP servers from database: {e}")
                servers = []
        else:
            print("⚠️  Database not available - cannot load user-specific MCP servers")
            return []
        
        # NO environment variable fallback - all MCPs must be user-specific and private
        # Removed: MCP_SERVERS_ENV fallback for security and privacy (no global MCPs)
        
        # Add any additional servers passed as argument (should also be user-specific)
        if additional_servers:
            servers.extend(additional_servers)
            print(f"📝 Added {len(additional_servers)} additional server(s) for user {user_id}")
        
        # No servers configured for this user
        if not servers:
            print(f"📝 No MCP servers configured for user {user_id} - agent will use local tools only")
        
        return servers
    
    @classmethod
    def load_llm_config(cls, db: Optional[Session] = None, user_id: Optional[int] = None) -> dict:
        """
        Load LLM configuration from database for a specific user, with fallback to default DeepSeek.
        Checks database for user's active config first, then falls back to default DeepSeek.
        
        Args:
            db: Optional database session (if None, creates a new one)
            user_id: Optional user ID to load user-specific config. If None, loads default config.
        
        Returns:
            Dictionary with LLM configuration including type, model, api_key, etc.
        """
        # Load from database: prioritize user-specific, then global, then default
        if DB_AVAILABLE:
            try:
                if db:
                    # Use provided session
                    if user_id:
                        # First try user-specific active config
                        llm_config = db.query(LLMConfig).filter(
                            LLMConfig.user_id == user_id,
                            LLMConfig.active == True
                        ).first()
                        
                        # If no user-specific active config, fall back to global config
                        # This allows users to use global configs as defaults when they don't have personal configs
                        # Prioritize global configs marked as default, then by creation date
                        if not llm_config:
                            llm_config = db.query(LLMConfig).filter(
                                LLMConfig.user_id.is_(None),
                                LLMConfig.active == True
                            ).order_by(
                                LLMConfig.is_default.desc(),  # Default configs first
                                LLMConfig.created_at.desc()    # Then newest first
                            ).first()
                    else:
                        # Load global default config (no user_id)
                        # Prioritize global configs marked as default, then by creation date
                        llm_config = db.query(LLMConfig).filter(
                            LLMConfig.user_id.is_(None),
                            LLMConfig.active == True
                        ).order_by(
                            LLMConfig.is_default.desc(),  # Default configs first
                            LLMConfig.created_at.desc()    # Then newest first
                        ).first()
                    
                    if llm_config:
                        config = llm_config.to_dict(include_api_key=True)
                        # Ensure API key is loaded from environment if not in database
                        if not config.get('api_key'):
                            if config.get('type', '').lower() == 'gemini':
                                config['api_key'] = os.getenv("GOOGLE_API_KEY")
                            elif config.get('type', '').lower() == 'openai':
                                # OPENAI_API_KEY is ONLY for embeddings, use OPENAI_LLM_API_KEY for LLM
                                config['api_key'] = os.getenv("OPENAI_LLM_API_KEY")
                            elif config.get('type', '').lower() == 'deepseek':
                                config['api_key'] = os.getenv("DEEPSEEK_KEY")
                            elif config.get('type', '').lower() == 'groq':
                                config['api_key'] = os.getenv("GROQ_API_KEY")
                            elif config.get('type', '').lower() == 'openrouter':
                                config['api_key'] = os.getenv("OPENROUTER_API_KEY")
                            elif config.get('type', '').lower() == 'ollama':
                                # Ollama doesn't need API key
                                pass
                        
                        print(f"📝 Loaded LLM config from database (user_id={user_id}): {config.get('type', 'unknown')} - {config.get('model', 'unknown')}")
                        return config
                else:
                    # Create new session
                    with get_db_context() as session:
                        if user_id:
                            # First try user-specific active config
                            llm_config = session.query(LLMConfig).filter(
                                LLMConfig.user_id == user_id,
                                LLMConfig.active == True
                            ).first()
                            
                            # If no user-specific config, fall back to global config
                            # Prioritize global configs marked as default, then by creation date
                            if not llm_config:
                                llm_config = session.query(LLMConfig).filter(
                                    LLMConfig.user_id.is_(None),
                                    LLMConfig.active == True
                                ).order_by(
                                    LLMConfig.is_default.desc(),  # Default configs first
                                    LLMConfig.created_at.desc()    # Then newest first
                                ).first()
                        else:
                            # Load global default config (no user_id)
                            # Prioritize global configs marked as default, then by creation date
                            llm_config = session.query(LLMConfig).filter(
                                LLMConfig.user_id.is_(None),
                                LLMConfig.active == True
                            ).order_by(
                                LLMConfig.is_default.desc(),  # Default configs first
                                LLMConfig.created_at.desc()    # Then newest first
                            ).first()
                        
                        if llm_config:
                            config = llm_config.to_dict(include_api_key=True)
                            # Ensure API key is loaded from environment if not in database
                            if not config.get('api_key'):
                                if config.get('type', '').lower() == 'gemini':
                                    config['api_key'] = os.getenv("GOOGLE_API_KEY")
                                elif config.get('type', '').lower() == 'openai':
                                    # OPENAI_API_KEY is ONLY for embeddings, use OPENAI_LLM_API_KEY for LLM
                                    config['api_key'] = os.getenv("OPENAI_LLM_API_KEY")
                                elif config.get('type', '').lower() == 'deepseek':
                                    config['api_key'] = os.getenv("DEEPSEEK_KEY")
                                elif config.get('type', '').lower() == 'groq':
                                    config['api_key'] = os.getenv("GROQ_API_KEY")
                                elif config.get('type', '').lower() == 'openrouter':
                                    config['api_key'] = os.getenv("OPENROUTER_API_KEY")
                                elif config.get('type', '').lower() == 'ollama':
                                    pass
                            
                            print(f"📝 Loaded LLM config from database (user_id={user_id}): {config.get('type', 'unknown')} - {config.get('model', 'unknown')}")
                            return config
            except Exception as e:
                print(f"⚠️  Failed to load LLM config from database: {e}")
        
        # Fallback to default DeepSeek from environment
        # Note: OPENAI_API_KEY is ONLY for embeddings, not for LLM responses
        deepseek_api_key = os.getenv("DEEPSEEK_KEY")
        
        # Try to save default DeepSeek config to database if DB is available and user_id is set
        if DB_AVAILABLE and user_id is not None and db:
            try:
                # Check if default DeepSeek config exists for this user
                existing_default = db.query(LLMConfig).filter(
                    LLMConfig.user_id == user_id,
                    LLMConfig.type == "deepseek",
                    LLMConfig.model == "deepseek-chat",
                    LLMConfig.is_default == True
                ).first()
                
                if not existing_default:
                    # Create default DeepSeek config in database for this user
                    default_llm_config = LLMConfig(
                        user_id=user_id,
                        type="deepseek",
                        model="deepseek-chat",
                        api_key=deepseek_api_key,
                        api_base="https://api.deepseek.com",
                        active=True,
                        is_default=True
                    )
                    db.add(default_llm_config)
                    try:
                        db.commit()
                        db.refresh(default_llm_config)
                        print(f"✓ Created default DeepSeek LLM config in database for user {user_id}")
                        return default_llm_config.to_dict(include_api_key=True)
                    except Exception as commit_error:
                        db.rollback()
                        print(f"⚠️  Failed to save default DeepSeek config to database: {commit_error}")
                elif not existing_default.active:
                    # Reactivate existing default config
                    existing_default.active = True
                    if deepseek_api_key:
                        existing_default.api_key = deepseek_api_key
                    try:
                        db.commit()
                        db.refresh(existing_default)
                        print(f"✓ Reactivated default DeepSeek LLM config for user {user_id}")
                        return existing_default.to_dict(include_api_key=True)
                    except Exception as commit_error:
                        db.rollback()
                        print(f"⚠️  Failed to reactivate default DeepSeek config: {commit_error}")
                else:
                    # Use existing active default config
                    if deepseek_api_key and not existing_default.api_key:
                        existing_default.api_key = deepseek_api_key
                        try:
                            db.commit()
                        except:
                            db.rollback()
                    return existing_default.to_dict(include_api_key=True)
            except Exception as e:
                print(f"⚠️  Error managing default DeepSeek config in database: {e}")
        
        # Fallback: return config dict (not in database)
        default_config = {
            "type": "deepseek",
            "model": "deepseek-chat",
            "api_key": deepseek_api_key,  # Get from environment (may be None)
            "api_base": "https://api.deepseek.com",
            "active": True,
            "is_default": True  # Mark as default LLM
        }
        
        # Warn if API key is missing
        if not default_config["api_key"]:
            print("⚠️  Warning: DEEPSEEK_KEY not set. Please set it as an environment variable or configure in database")
            print("   Set it with: export DEEPSEEK_KEY='your-api-key'")
            print("   Or configure it in the frontend Settings panel")
            print("   Note: OPENAI_API_KEY is only used for embeddings, not for LLM responses")
        else:
            print(f"📝 Using fallback LLM config: DeepSeek (deepseek-chat) from environment")
        
        return default_config
    
    @classmethod
    def save_llm_config(cls, config: dict, db: Optional[Session] = None) -> bool:
        """
        Save LLM configuration to database.
        Users can switch to any model/LLM, but the default OpenAI GPT config
        will always be preserved (just deactivated when switching).
        Args:
            config: Configuration dictionary
            db: Optional database session (if None, creates a new one)
        """
        if not DB_AVAILABLE:
            raise Exception("Database not available. Cannot save LLM config.")
        
        try:
            if db:
                # Use provided session (caller will commit)
                session = db
            else:
                # Create new session using context manager
                with get_db_context() as session:
                    # Deactivate all existing configs (they are preserved, just not active)
                    # This allows users to switch models while keeping history
                    session.query(LLMConfig).update({LLMConfig.active: False})
                    
                    # Create new active config with user's chosen model/LLM
                    llm_config = LLMConfig(
                        type=config.get('type', 'gemini'),
                        model=config.get('model', 'gpt-4o'),
                        api_key=config.get('api_key'),
                        base_url=config.get('base_url'),
                        api_base=config.get('api_base'),
                        active=True
                    )
                    session.add(llm_config)
                    # Context manager will commit automatically
                
                print(f"✓ LLM config saved to database: {config.get('type', 'unknown')} - {config.get('model', 'unknown')}")
                return True
            
            # If using provided session, update here (caller will commit)
            # Deactivate all existing configs (they are preserved, just not active)
            session.query(LLMConfig).update({LLMConfig.active: False})
            
            # Create new active config with user's chosen model/LLM
            llm_config = LLMConfig(
                type=config.get('type', 'gemini'),
                model=config.get('model', 'gemini-2.0-flash'),
                api_key=config.get('api_key'),
                base_url=config.get('base_url'),
                api_base=config.get('api_base'),
                active=True
            )
            session.add(llm_config)
            # Don't commit - caller handles it
            
            print(f"✓ LLM config saved to database: {config.get('type', 'unknown')} - {config.get('model', 'unknown')}")
            return True
        except Exception as e:
            print(f"⚠️  Failed to save LLM config to database: {e}")
            raise

