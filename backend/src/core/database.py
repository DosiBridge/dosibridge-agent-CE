"""
Database configuration and session management
"""
import os
from contextlib import contextmanager
from typing import Optional

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
        except Exception as e:
            print(f"⚠️  Migration check failed (this is okay if columns already exist): {e}")
    except Exception as e:
        print(f"⚠️  Failed to initialize database tables: {e}")
