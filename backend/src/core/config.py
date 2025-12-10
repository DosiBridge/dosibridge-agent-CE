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
        
        # Load from database - user-specific servers AND global servers (user_id=1 or None)
        # Global servers are owned by superadmin (user_id=1) or None (for backward compatibility)
        if DB_AVAILABLE:
            try:
                if db:
                    # Use provided session - get user-specific AND global servers
                    from sqlalchemy import or_
                    query = db.query(MCPServer).filter(
                        MCPServer.enabled == True,
                        or_(
                            MCPServer.user_id == user_id,  # User's own servers
                            MCPServer.user_id == 1,        # Global servers owned by superadmin
                            MCPServer.user_id.is_(None)    # Global servers (backward compatibility)
                        )
                    )
                    db_servers = query.all()
                    servers = [s.to_dict(include_api_key=True) for s in db_servers]
                    # Mark global servers (user_id=1 or None)
                    for server in servers:
                        server_user_id = db_servers[servers.index(server)].user_id
                        server['is_global'] = (server_user_id == 1 or server_user_id is None)
                else:
                    # Create new session - get user-specific AND global servers
                    with get_db_context() as session:
                        from sqlalchemy import or_
                        query = session.query(MCPServer).filter(
                            MCPServer.enabled == True,
                            or_(
                                MCPServer.user_id == user_id,  # User's own servers
                                MCPServer.user_id == 1,        # Global servers owned by superadmin
                                MCPServer.user_id.is_(None)    # Global servers (backward compatibility)
                            )
                        )
                        db_servers = query.all()
                        servers = [s.to_dict(include_api_key=True) for s in db_servers]
                        # Mark global servers (user_id=1 or None)
                        for server in servers:
                            server_user_id = db_servers[servers.index(server)].user_id
                            server['is_global'] = (server_user_id == 1 or server_user_id is None)
                
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
    def load_llm_config(cls, db: Optional[Session] = None, user_id: Optional[int] = None) -> Optional[dict]:
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
                        # Regular users can only use global configs that are BOTH active AND default
                        # Global configs are owned by superadmin (user_id=1) or None (for backward compatibility)
                        # Prioritize global configs marked as default, then by creation date
                        if not llm_config:
                            from sqlalchemy import or_
                            llm_config = db.query(LLMConfig).filter(
                                or_(LLMConfig.user_id == 1, LLMConfig.user_id.is_(None)),
                                LLMConfig.active == True,
                                LLMConfig.is_default == True  # Must be default for regular users
                            ).order_by(
                                LLMConfig.is_default.desc(),  # Default configs first
                                LLMConfig.created_at.desc()    # Then newest first
                            ).first()
                    else:
                        # Load global default config (no user_id)
                        # Only load global configs that are BOTH active AND default
                        # Global configs are owned by superadmin (user_id=1) or None (for backward compatibility)
                        from sqlalchemy import or_
                        llm_config = db.query(LLMConfig).filter(
                            or_(LLMConfig.user_id == 1, LLMConfig.user_id.is_(None)),
                            LLMConfig.active == True,
                            LLMConfig.is_default == True  # Must be default
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
                            # Global configs are owned by superadmin (user_id=1) or None (for backward compatibility)
                            # Prioritize global configs marked as default, then by creation date
                            if not llm_config:
                                from sqlalchemy import or_
                                llm_config = session.query(LLMConfig).filter(
                                    or_(LLMConfig.user_id == 1, LLMConfig.user_id.is_(None)),
                                    LLMConfig.active == True
                                ).order_by(
                                    LLMConfig.is_default.desc(),  # Default configs first
                                    LLMConfig.created_at.desc()    # Then newest first
                            ).first()
                        else:
                            # Load global default config (no user_id)
                            # Global configs are owned by superadmin (user_id=1) or None (for backward compatibility)
                            # Prioritize global configs marked as default, then by creation date
                            from sqlalchemy import or_
                            llm_config = session.query(LLMConfig).filter(
                                or_(LLMConfig.user_id == 1, LLMConfig.user_id.is_(None)),
                                LLMConfig.active == True
                            ).order_by(
                                LLMConfig.is_default.desc(),  # Default configs first
                                LLMConfig.created_at.desc()    # Then newest first
                            ).first()
                        
                        if llm_config:
                            config = llm_config.to_dict(include_api_key=True)
                            # Fallback: Load API key from environment if missing in database
                            # This is only a fallback - superadmin should configure API keys via dashboard
                            # Note: OPENAI_API_KEY is ONLY for embeddings, not for LLM
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
                                # If still no API key, warn but don't fail (superadmin should configure via dashboard)
                                if not config.get('api_key'):
                                    print(f"⚠️  No API key found for {config.get('type')} config. Please configure via superadmin dashboard.")
                            
                            print(f"📝 Loaded LLM config from database (user_id={user_id}): {config.get('type', 'unknown')} - {config.get('model', 'unknown')}")
                            return config
            except Exception as e:
                print(f"⚠️  Failed to load LLM config from database: {e}")
        
        # No automatic fallback to environment variables after first initialization
        # LLM configs must be configured via superadmin dashboard
        # If no config found, return None - callers should handle this gracefully
        if DB_AVAILABLE and user_id is not None:
            print(f"⚠️  No active LLM configuration found for user {user_id}. "
                  "Please configure LLM providers via the superadmin dashboard or create a personal LLM config.")
        else:
            print("⚠️  No active LLM configuration found. "
                  "Please configure LLM providers via the superadmin dashboard.")
        return None
    
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

