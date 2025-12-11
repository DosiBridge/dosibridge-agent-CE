"""
Migration script to make hashed_password column nullable in users table
This is needed for OAuth users who don't have passwords
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from src.core.database import get_db_context, DB_AVAILABLE
from sqlalchemy import text

def make_password_nullable():
    """Make hashed_password column nullable in users table"""
    if not DB_AVAILABLE:
        print("❌ Database not available")
        return
    
    with get_db_context() as db:
        try:
            # Check current constraint
            result = db.execute(text("""
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='hashed_password'
            """))
            
            row = result.fetchone()
            if not row:
                print("❌ hashed_password column not found")
                return
            
            is_nullable = row[0]
            if is_nullable == 'YES':
                print("✓ hashed_password column is already nullable")
            else:
                # Make column nullable
                print("📝 Making hashed_password column nullable...")
                db.execute(text("""
                    ALTER TABLE users 
                    ALTER COLUMN hashed_password DROP NOT NULL
                """))
                db.commit()
                print("✓ hashed_password column is now nullable")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error making hashed_password nullable: {e}")
            raise

if __name__ == "__main__":
    make_password_nullable()

