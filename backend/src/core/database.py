"""
Database configuration and session management
"""
import os
from contextlib import contextmanager
from typing import Optional

# Load environment variables first before any config is read
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, use environment variables directly

# Try to import database dependencies
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker, Session
    DB_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  SQLAlchemy not available: {e}")
    DB_AVAILABLE = False
    Session = None  # type: ignore
    Base = None  # type: ignore

# Try to import psycopg2
try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    print("⚠️  psycopg2 not available. Install with: pip install psycopg2-binary")

# Get database URL from environment
# Must be set via environment variable or .env file
# No hardcoded fallback - ensures explicit configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Please set it in your .env file or environment. "
        "Example: postgresql://user:password@host:port/database"
    )

# Initialize database components only if available
if DB_AVAILABLE and PSYCOPG2_AVAILABLE:
    try:
        # Create engine
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,  # Verify connections before using
            pool_size=10,
            max_overflow=20,
            echo=False  # Set to True for SQL query logging
        )
        
        # Create session factory
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Base class for models
        Base = declarative_base()
        
        print("✓ Database components initialized")
    except Exception as e:
        print(f"⚠️  Failed to initialize database engine: {e}")
        DB_AVAILABLE = False
        engine = None  # type: ignore
        SessionLocal = None  # type: ignore
        Base = None  # type: ignore
else:
    engine = None  # type: ignore
    SessionLocal = None  # type: ignore
    Base = None  # type: ignore


def get_db():
    """
    Dependency function for FastAPI to get database session.
    Usage: db: Session = Depends(get_db)
    """
    if not DB_AVAILABLE or not SessionLocal:
        raise RuntimeError("Database is not available. Please install psycopg2-binary and ensure DATABASE_URL is set.")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for database sessions.
    Usage:
        with get_db_context() as db:
            # use db
    """
    if not DB_AVAILABLE or not SessionLocal:
        raise RuntimeError("Database is not available. Please install psycopg2-binary and ensure DATABASE_URL is set.")
    
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    Call this on application startup.
    """
    if not DB_AVAILABLE or not engine or not Base:
        print("⚠️  Database not available, skipping initialization")
        return
    
    try:
        Base.metadata.create_all(bind=engine)
        print("✓ Database tables initialized")
        
        # Add user_id columns if they don't exist (migration)
        try:
            with engine.connect() as conn:
                # Check and add user_id to mcp_servers table
                result = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                         "WHERE table_name='mcp_servers' AND column_name='user_id'")
                )
                if not result.fetchone():
                    print("📝 Adding user_id column to mcp_servers table...")
                    conn.execute(
                        text("ALTER TABLE mcp_servers "
                             "ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
                    )
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mcp_servers_user_id ON mcp_servers(user_id)"))
                    # Drop existing unique constraint on name if it exists, then add new one
                    try:
                        conn.execute(text("ALTER TABLE mcp_servers DROP CONSTRAINT IF EXISTS mcp_servers_name_key"))
                    except:
                        pass
                    try:
                        conn.execute(
                            text("ALTER TABLE mcp_servers "
                                 "ADD CONSTRAINT uq_mcp_server_user_name UNIQUE (user_id, name)")
                        )
                    except:
                        pass  # Constraint might already exist
                    conn.commit()
                    print("✓ Added user_id column to mcp_servers table")
                
                # Check and add user_id to llm_config table (nullable for system-wide configs)
                result = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                         "WHERE table_name='llm_config' AND column_name='user_id'")
                )
                if not result.fetchone():
                    print("📝 Adding user_id column to llm_config table...")
                    conn.execute(
                        text("ALTER TABLE llm_config "
                             "ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
                    )
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_llm_config_user_id ON llm_config(user_id)"))
                    conn.commit()
                    print("✓ Added user_id column to llm_config table")
                else:
                    # Check if user_id is NOT NULL and make it nullable for system-wide configs
                    result = conn.execute(
                        text("SELECT is_nullable FROM information_schema.columns "
                             "WHERE table_name='llm_config' AND column_name='user_id'")
                    )
                    row = result.fetchone()
                    if row and row[0] == 'NO':
                        print("📝 Making user_id nullable in llm_config table (for system-wide configs)...")
                        try:
                            conn.execute(
                                text("ALTER TABLE llm_config ALTER COLUMN user_id DROP NOT NULL")
                            )
                            conn.commit()
                            print("✓ Made user_id nullable in llm_config table")
                        except Exception as e:
                            print(f"⚠️  Could not make user_id nullable: {e}")
                
                # Check and add is_default column to llm_config table
                result = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                         "WHERE table_name='llm_config' AND column_name='is_default'")
                )
                if not result.fetchone():
                    print("📝 Adding is_default column to llm_config table...")
                    conn.execute(
                        text("ALTER TABLE llm_config "
                             "ADD COLUMN is_default BOOLEAN DEFAULT FALSE NOT NULL")
                    )
                    conn.commit()
                    print("✓ Added is_default column to llm_config table")
                
                # Check and add connection_type to mcp_servers table
                result = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                         "WHERE table_name='mcp_servers' AND column_name='connection_type'")
                )
                if not result.fetchone():
                    print("📝 Adding connection_type column to mcp_servers table...")
                    conn.execute(
                        text("ALTER TABLE mcp_servers "
                             "ADD COLUMN connection_type VARCHAR(20) DEFAULT 'http' NOT NULL")
                    )
                    conn.commit()
                    print("✓ Added connection_type column to mcp_servers table")
                
                # Check and add headers column to mcp_servers table
                result = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                         "WHERE table_name='mcp_servers' AND column_name='headers'")
                )
                if not result.fetchone():
                    print("📝 Adding headers column to mcp_servers table...")
                    conn.execute(
                        text("ALTER TABLE mcp_servers "
                             "ADD COLUMN headers TEXT")
                    )
                    conn.commit()
                    print("✓ Added headers column to mcp_servers table")
                
                # Check if embedding_config table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='embedding_config'")
                )
                if not result.fetchone():
                    print("📝 Creating embedding_config table...")
                    conn.execute(
                        text("""
                            CREATE TABLE embedding_config (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                provider VARCHAR(50) NOT NULL DEFAULT 'openai',
                                model VARCHAR(200) NOT NULL DEFAULT 'text-embedding-3-small',
                                api_key TEXT,
                                base_url VARCHAR(500),
                                active BOOLEAN NOT NULL DEFAULT TRUE,
                                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP WITH TIME ZONE
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_embedding_config_user_id ON embedding_config(user_id)"))
                    conn.execute(text("CREATE INDEX idx_embedding_config_active ON embedding_config(active)"))
                    conn.execute(text("CREATE INDEX idx_embedding_config_is_default ON embedding_config(is_default)"))
                    conn.commit()
                    print("✓ Created embedding_config table")
                
                # Check if conversations table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='conversations'")
                )
                if not result.fetchone():
                    print("📝 Creating conversations table...")
                    conn.execute(
                        text("""
                            CREATE TABLE conversations (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                session_id VARCHAR(255) NOT NULL,
                                title VARCHAR(500),
                                summary TEXT,
                                message_count INTEGER DEFAULT 0 NOT NULL,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP WITH TIME ZONE,
                                UNIQUE(user_id, session_id)
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_conversations_user_id ON conversations(user_id)"))
                    conn.execute(text("CREATE INDEX idx_conversations_session_id ON conversations(session_id)"))
                    conn.commit()
                    print("✓ Created conversations table")
                else:
                    # Check if summary and message_count columns exist, add if missing
                    result = conn.execute(
                        text("SELECT column_name FROM information_schema.columns "
                             "WHERE table_name='conversations' AND column_name='summary'")
                    )
                    if not result.fetchone():
                        print("📝 Adding summary column to conversations table...")
                        conn.execute(
                            text("ALTER TABLE conversations ADD COLUMN summary TEXT")
                        )
                        conn.commit()
                        print("✓ Added summary column to conversations table")
                    
                    result = conn.execute(
                        text("SELECT column_name FROM information_schema.columns "
                             "WHERE table_name='conversations' AND column_name='message_count'")
                    )
                    if not result.fetchone():
                        print("📝 Adding message_count column to conversations table...")
                        conn.execute(
                            text("ALTER TABLE conversations ADD COLUMN message_count INTEGER DEFAULT 0 NOT NULL")
                        )
                        conn.commit()
                        print("✓ Added message_count column to conversations table")
                
                # Check if messages table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='messages'")
                )
                if not result.fetchone():
                    print("📝 Creating messages table...")
                    conn.execute(
                        text("""
                            CREATE TABLE messages (
                                id SERIAL PRIMARY KEY,
                                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                                role VARCHAR(50) NOT NULL,
                                content TEXT NOT NULL,
                                tool_calls TEXT,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_messages_conversation_id ON messages(conversation_id)"))
                    conn.execute(text("CREATE INDEX idx_messages_created_at ON messages(created_at)"))
                    conn.commit()
                    print("✓ Created messages table")
                
                # Check if document_collections table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='document_collections'")
                )
                if not result.fetchone():
                    print("📝 Creating document_collections table...")
                    conn.execute(
                        text("""
                            CREATE TABLE document_collections (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                name VARCHAR(255) NOT NULL,
                                description TEXT,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP WITH TIME ZONE,
                                UNIQUE(user_id, name)
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_document_collections_user_id ON document_collections(user_id)"))
                    conn.commit()
                    print("✓ Created document_collections table")
                
                # Check if documents table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='documents'")
                )
                if not result.fetchone():
                    print("📝 Creating documents table...")
                    conn.execute(
                        text("""
                            CREATE TABLE documents (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                collection_id INTEGER REFERENCES document_collections(id) ON DELETE SET NULL,
                                filename VARCHAR(500) NOT NULL,
                                original_filename VARCHAR(500) NOT NULL,
                                file_path VARCHAR(1000) NOT NULL,
                                file_type VARCHAR(50) NOT NULL,
                                file_size INTEGER NOT NULL,
                                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                                document_metadata TEXT,
                                chunk_count INTEGER DEFAULT 0 NOT NULL,
                                embedding_status VARCHAR(50) NOT NULL DEFAULT 'pending',
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP WITH TIME ZONE
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_documents_user_id ON documents(user_id)"))
                    conn.execute(text("CREATE INDEX idx_documents_collection_id ON documents(collection_id)"))
                    conn.commit()
                    print("✓ Created documents table")
                
                # Check if document_chunks table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='document_chunks'")
                )
                if not result.fetchone():
                    print("📝 Creating document_chunks table...")
                    conn.execute(
                        text("""
                            CREATE TABLE document_chunks (
                                id SERIAL PRIMARY KEY,
                                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                                chunk_index INTEGER NOT NULL,
                                content TEXT NOT NULL,
                                chunk_metadata TEXT,
                                embedding TEXT,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id)"))
                    conn.commit()
                    print("✓ Created document_chunks table")
                
                # Check if api_usage table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='api_usage'")
                )
                if not result.fetchone():
                    print("📝 Creating api_usage table...")
                    conn.execute(
                        text("""
                            CREATE TABLE api_usage (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                ip_address VARCHAR(45),
                                usage_date TIMESTAMP WITH TIME ZONE NOT NULL,
                                request_count INTEGER DEFAULT 0 NOT NULL,
                                llm_provider VARCHAR(50),
                                llm_model VARCHAR(100),
                                input_tokens INTEGER DEFAULT 0 NOT NULL,
                                output_tokens INTEGER DEFAULT 0 NOT NULL,
                                embedding_tokens INTEGER DEFAULT 0 NOT NULL,
                                mode VARCHAR(20),
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP WITH TIME ZONE,
                                CONSTRAINT uq_api_usage_user_date UNIQUE (user_id, usage_date)
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_api_usage_user_id ON api_usage(user_id)"))
                    conn.execute(text("CREATE INDEX idx_api_usage_ip_address ON api_usage(ip_address)"))
                    conn.execute(text("CREATE INDEX idx_api_usage_date ON api_usage(usage_date)"))
                    conn.commit()
                    print("✓ Created api_usage table")
                else:
                    # Migration: Add ip_address column if it doesn't exist
                    result = conn.execute(
                        text("SELECT column_name FROM information_schema.columns "
                             "WHERE table_name='api_usage' AND column_name='ip_address'")
                    )
                    if not result.fetchone():
                        print("📝 Adding ip_address column to api_usage table...")
                        conn.execute(
                            text("ALTER TABLE api_usage "
                                 "ADD COLUMN ip_address VARCHAR(45)")
                        )
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_api_usage_ip_address ON api_usage(ip_address)"))
                        
                        # Add unique constraint for ip_address + usage_date if it doesn't exist
                        result = conn.execute(
                            text("SELECT constraint_name FROM information_schema.table_constraints "
                                 "WHERE table_name='api_usage' AND constraint_name='uq_api_usage_ip_date'")
                        )
                        if not result.fetchone():
                            try:
                                conn.execute(
                                    text("ALTER TABLE api_usage "
                                         "ADD CONSTRAINT uq_api_usage_ip_date UNIQUE (ip_address, usage_date)")
                                )
                            except Exception as e:
                                print(f"⚠️  Could not add unique constraint (may already exist): {e}")
                        
                        conn.commit()
                        print("✓ Added ip_address column to api_usage table")
                
                # Check if api_requests table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='api_requests'")
                )
                if not result.fetchone():
                    print("📝 Creating api_requests table...")
                    conn.execute(
                        text("""
                            CREATE TABLE api_requests (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                                llm_provider VARCHAR(50),
                                llm_model VARCHAR(100),
                                input_tokens INTEGER DEFAULT 0 NOT NULL,
                                output_tokens INTEGER DEFAULT 0 NOT NULL,
                                embedding_tokens INTEGER DEFAULT 0 NOT NULL,
                                total_tokens INTEGER DEFAULT 0 NOT NULL,
                                mode VARCHAR(20),
                                session_id VARCHAR(255),
                                success BOOLEAN DEFAULT TRUE NOT NULL,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_api_requests_user_id ON api_requests(user_id)"))
                    conn.execute(text("CREATE INDEX idx_api_requests_timestamp ON api_requests(request_timestamp)"))
                    conn.execute(text("CREATE INDEX idx_api_requests_session_id ON api_requests(session_id)"))
                    conn.execute(text("CREATE INDEX idx_api_requests_created_at ON api_requests(created_at)"))
                    conn.commit()
                    print("✓ Created api_requests table")
                
                # Check if user_global_config_preferences table exists
                result = conn.execute(
                    text("SELECT table_name FROM information_schema.tables "
                         "WHERE table_name='user_global_config_preferences'")
                )
                if not result.fetchone():
                    print("📝 Creating user_global_config_preferences table...")
                    conn.execute(
                        text("""
                            CREATE TABLE user_global_config_preferences (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                config_type VARCHAR(50) NOT NULL,
                                config_id INTEGER NOT NULL,
                                enabled BOOLEAN DEFAULT TRUE NOT NULL,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP WITH TIME ZONE,
                                UNIQUE(user_id, config_type, config_id)
                            )
                        """)
                    )
                    conn.execute(text("CREATE INDEX idx_user_global_config_pref_user_id ON user_global_config_preferences(user_id)"))
                    conn.execute(text("CREATE INDEX idx_user_global_config_pref_config ON user_global_config_preferences(config_type, config_id)"))
                    conn.commit()
                    print("✓ Created user_global_config_preferences table")
        except Exception as e:
            print(f"⚠️  Migration check failed (this is okay if columns already exist): {e}")
    except Exception as e:
        print(f"⚠️  Failed to initialize database tables: {e}")
