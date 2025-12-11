"""
Migration script to add OTP columns (otp_hash and otp_expires_at) to users table
Run this once to add the OTP columns to existing databases
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from src.core.database import get_db_context, DB_AVAILABLE
from sqlalchemy import text

def add_otp_columns():
    """Add OTP columns to users table if they don't exist"""
    if not DB_AVAILABLE:
        print("❌ Database not available")
        return
    
    with get_db_context() as db:
        try:
            # Check if otp_hash column already exists
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='otp_hash'
            """))
            
            if result.fetchone():
                print("✓ otp_hash column already exists")
            else:
                # Add otp_hash column
                db.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN otp_hash VARCHAR(255)
                """))
                db.commit()
                print("✓ otp_hash column added successfully")
            
            # Check if otp_expires_at column already exists
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='otp_expires_at'
            """))
            
            if result.fetchone():
                print("✓ otp_expires_at column already exists")
            else:
                # Add otp_expires_at column
                db.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN otp_expires_at TIMESTAMP WITH TIME ZONE
                """))
                db.commit()
                print("✓ otp_expires_at column added successfully")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error adding OTP columns: {e}")
            raise

if __name__ == "__main__":
    add_otp_columns()

