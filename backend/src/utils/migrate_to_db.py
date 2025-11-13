"""
Migration script to migrate JSON config files to PostgreSQL database
Run this once to migrate existing data from JSON files to database
Note: JSON files are no longer used - all config is in database
"""
import json
import os
from pathlib import Path
from sqlalchemy.orm import Session
from .database import init_db, get_db_context, engine
from .models import LLMConfig, MCPServer

ROOT_DIR = Path(__file__).parent.parent


def migrate_llm_config(db: Session):
    """Migrate LLM config from JSON to database, or create default Gemini config"""
    config_file = ROOT_DIR / "config" / "llm_config.json"
    
    # Check if config already exists in database
    existing = db.query(LLMConfig).filter(LLMConfig.active == True).first()
    if existing:
        print("✓ LLM config already exists in database, skipping migration")
        return
    
    # Try to migrate from JSON file if it exists
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            
            # Create new config from JSON
            llm_config = LLMConfig(
                type=config_data.get("type", "gemini"),
                model=config_data.get("model", "gemini-2.0-flash"),
                api_key=config_data.get("api_key"),
                base_url=config_data.get("base_url"),
                api_base=config_data.get("api_base"),
                active=config_data.get("active", True)
            )
            db.add(llm_config)
            db.commit()
            print(f"✓ Migrated LLM config: {llm_config.type} - {llm_config.model}")
            return
        except Exception as e:
            print(f"⚠️  Failed to migrate LLM config from file: {e}")
            db.rollback()
    
    # Create default Gemini config if no config exists
    import os
    default_config = LLMConfig(
        type="gemini",
        model="gemini-2.0-flash",
        api_key=os.getenv("GOOGLE_API_KEY"),  # Get from environment
        active=True
    )
    db.add(default_config)
    db.commit()
    print(f"✓ Created default LLM config: {default_config.type} - {default_config.model}")


def migrate_mcp_servers(db: Session):
    """Migrate MCP servers from JSON to database"""
    config_file = ROOT_DIR / "config" / "mcp_servers.json"
    
    if not config_file.exists():
        print("⚠️  No MCP servers config file found, skipping migration")
        return
    
    try:
        with open(config_file, 'r') as f:
            servers_data = json.load(f)
        
        if not isinstance(servers_data, list):
            print("⚠️  Invalid MCP servers file format, skipping migration")
            return
        
        migrated_count = 0
        for server_data in servers_data:
            name = server_data.get("name")
            if not name:
                continue
            
            # Check if server already exists
            existing = db.query(MCPServer).filter(MCPServer.name == name).first()
            if existing:
                print(f"  ⚠️  Server '{name}' already exists, skipping")
                continue
            
            # Normalize URL
            url = server_data.get("url", "").rstrip('/')
            if url.endswith('/sse'):
                url = url[:-4]
            if not url.endswith('/mcp'):
                url = url.rstrip('/') + '/mcp'
            
            # Create new server
            mcp_server = MCPServer(
                name=name,
                url=url,
                api_key=server_data.get("api_key"),
                enabled=server_data.get("enabled", True)
            )
            db.add(mcp_server)
            migrated_count += 1
        
        db.commit()
        print(f"✓ Migrated {migrated_count} MCP server(s)")
    except Exception as e:
        print(f"⚠️  Failed to migrate MCP servers: {e}")
        db.rollback()


def main():
    """Run migration"""
    print("🔄 Starting migration from JSON to PostgreSQL...")
    
    # Initialize database tables
    print("📦 Creating database tables...")
    init_db()
    
    # Migrate data
    with get_db_context() as db:
        print("\n📝 Migrating LLM config...")
        migrate_llm_config(db)
        
        print("\n📝 Migrating MCP servers...")
        migrate_mcp_servers(db)
    
    print("\n✅ Migration completed!")


if __name__ == "__main__":
    main()

