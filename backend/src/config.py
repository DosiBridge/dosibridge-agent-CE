"""
Configuration and environment management
"""
import os
import json
from pathlib import Path

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not available, using environment variables directly")


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
    def load_mcp_servers(cls, additional_servers: list = None) -> list[dict]:
        """
        Load MCP servers from multiple sources:
        1. Environment variable MCP_SERVERS (JSON array)
        2. Config file mcp_servers.json
        3. Additional servers passed as argument
        """
        servers = []
        
        # Method 1: From environment variable
        if cls.MCP_SERVERS_ENV:
            try:
                env_servers = json.loads(cls.MCP_SERVERS_ENV)
                servers.extend(env_servers)
                print(f"📝 Loaded {len(env_servers)} server(s) from MCP_SERVERS env variable")
            except json.JSONDecodeError as e:
                print(f"⚠️  Failed to parse MCP_SERVERS env variable: {e}")
        
        # Method 2: From config file
        config_file = cls.ROOT_DIR / cls.MCP_SERVERS_FILE
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    file_servers = json.load(f)
                    servers.extend(file_servers)
                    print(f"📝 Loaded {len(file_servers)} server(s) from {cls.MCP_SERVERS_FILE}")
            except Exception as e:
                print(f"⚠️  Failed to load {cls.MCP_SERVERS_FILE}: {e}")
        
        # Method 3: No servers configured
        if not servers:
            print("📝 No MCP servers configured - agent will use local tools only")
        
        # Add any additional servers passed as argument
        if additional_servers:
            servers.extend(additional_servers)
            print(f"📝 Added {len(additional_servers)} additional server(s)")
        
        return servers
    
    @classmethod
    def load_llm_config(cls) -> dict:
        """
        Load LLM configuration from file.
        Returns default OpenAI config if file doesn't exist.
        """
        config_file = cls.ROOT_DIR / cls.LLM_CONFIG_FILE
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    config = json.load(f)
                    # Validate and clean the config
                    if not config.get('model') or not config['model'].strip():
                        # If model is empty, set default based on type
                        llm_type = config.get('type', 'openai').lower()
                        if llm_type == 'gemini':
                            config['model'] = 'gemini-1.5-flash'
                        elif llm_type == 'ollama':
                            config['model'] = 'llama3.2'
                        else:
                            config['model'] = cls.OPENAI_MODEL
                    else:
                        config['model'] = config['model'].strip()
                    
                    print(f"📝 Loaded LLM config: {config.get('type', 'openai')} - {config.get('model', 'unknown')}")
                    return config
            except Exception as e:
                print(f"⚠️  Failed to load {cls.LLM_CONFIG_FILE}: {e}")
        
        # Default to OpenAI
        default_config = {
            "type": "openai",
            "model": cls.OPENAI_MODEL,
            "api_key": cls.OPENAI_API_KEY,
            "active": True
        }
        return default_config
    
    @classmethod
    def save_llm_config(cls, config: dict) -> bool:
        """
        Save LLM configuration to file.
        """
        try:
            config_file = cls.ROOT_DIR / cls.LLM_CONFIG_FILE
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
            print(f"✓ LLM config saved: {config.get('type', 'unknown')} - {config.get('model', 'unknown')}")
            return True
        except Exception as e:
            print(f"⚠️  Failed to save {cls.LLM_CONFIG_FILE}: {e}")
            return False

