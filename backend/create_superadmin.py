"""
Script to create superadmin user
Run this script to create the superadmin user.
Email and password are read from environment variables:
- SUPERADMIN_EMAIL (default: super@mail.com)
- SUPERADMIN_PASSWORD (default: sparrow)
"""
import os
import sys
from pathlib import Path

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, use environment variables directly

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from src.core.database import get_db_context
from src.core.models import User
from src.core.auth import get_password_hash

def create_superadmin():
    """Create superadmin user if it doesn't exist. Ensures superadmin always has ID=1."""
    # Get email and password from environment variables
    superadmin_email = os.getenv("SUPERADMIN_EMAIL", "super@mail.com")
    superadmin_password = os.getenv("SUPERADMIN_PASSWORD", "sparrow")
    
    if not superadmin_email or not superadmin_password:
        print("❌ Error: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set")
        print("   Set them in .env file or as environment variables")
        return
    
    with get_db_context() as db:
        try:
            # Check if superadmin with ID=1 already exists
            superadmin_id_1 = db.query(User).filter(User.id == 1).first()
            
            if superadmin_id_1:
                # User with ID=1 exists - ensure it's superadmin
                if hasattr(superadmin_id_1, 'role'):
                    if superadmin_id_1.role == "superadmin":
                        # Update email/password if needed (in case env vars changed)
                        if superadmin_id_1.email != superadmin_email:
                            print(f"⚠️  Superadmin ID=1 exists with different email ({superadmin_id_1.email}).")
                            print(f"   Keeping existing email. To change, update directly in database.")
                        if superadmin_password:
                            superadmin_id_1.hashed_password = get_password_hash(superadmin_password)
                        superadmin_id_1.is_active = True
                        db.commit()
                        print(f"✓ Superadmin (ID=1) already exists: {superadmin_id_1.email}")
                        return
                    else:
                        # User ID=1 exists but is not superadmin - update it
                        superadmin_id_1.role = "superadmin"
                        superadmin_id_1.is_active = True
                        if superadmin_password:
                            superadmin_id_1.hashed_password = get_password_hash(superadmin_password)
                        db.commit()
                        print(f"✓ Updated user ID=1 to superadmin: {superadmin_id_1.email}")
                        return
                else:
                    # Role column doesn't exist, need to add it first
                    print("⚠️  Role column not found. Please run add_role_column.py first")
                    return
            
            # Check if superadmin with same email exists (but different ID)
            existing = db.query(User).filter(User.email == superadmin_email).first()
            if existing:
                if existing.id != 1:
                    # Superadmin exists but with wrong ID - need to handle this carefully
                    print(f"⚠️  Superadmin exists with ID={existing.id}, but ID=1 is required.")
                    print(f"   Please manually update or delete user ID={existing.id} and recreate.")
                    return
                # If we get here, existing.id == 1, which we already checked above
                return
            
            # No user with ID=1 exists - create superadmin
            # Try to insert with explicit ID=1
            hashed_password = get_password_hash(superadmin_password)
            
            # Use raw SQL to ensure ID=1 if possible, otherwise let auto-increment handle it
            from sqlalchemy import text
            try:
                # Try to insert with ID=1 explicitly
                result = db.execute(
                    text("INSERT INTO users (id, email, name, hashed_password, is_active, role) "
                         "VALUES (1, :email, :name, :hashed_password, :is_active, :role) "
                         "ON CONFLICT (id) DO UPDATE SET role = :role, is_active = :is_active"),
                    {
                        "email": superadmin_email,
                        "name": "Super Admin",
                        "hashed_password": hashed_password,
                        "is_active": True,
                        "role": "superadmin"
                    }
                )
                db.commit()
                
                # Verify it was created with ID=1
                superadmin = db.query(User).filter(User.email == superadmin_email).first()
                if superadmin and superadmin.id == 1:
                    print("✓ Superadmin user created successfully with ID=1!")
                    print(f"  Email: {superadmin_email}")
                    print(f"  Password: {'*' * len(superadmin_password)} (hidden)")
                    print(f"  Role: superadmin")
                    print(f"  ID: 1 (fixed)")
                    return
            except Exception as sql_error:
                db.rollback()
                # Fallback to ORM if raw SQL fails
                print(f"⚠️  Could not insert with ID=1 directly: {sql_error}")
                print("   Attempting standard insert...")
            
            # Fallback: Create normally and then update sequence if needed
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
            
            # If ID is not 1, try to update it (PostgreSQL specific)
            if superadmin.id != 1:
                try:
                    from sqlalchemy import text
                    # Update the sequence to start from 2 (since we have ID=1 now)
                    db.execute(text("SELECT setval('users_id_seq', GREATEST(1, (SELECT MAX(id) FROM users)))"))
                    db.commit()
                    print(f"⚠️  Superadmin created with ID={superadmin.id} instead of ID=1.")
                    print(f"   This may cause issues. Consider manually updating the user ID to 1.")
                except Exception as seq_error:
                    print(f"⚠️  Could not update sequence: {seq_error}")
            
            print("✓ Superadmin user created successfully!")
            print(f"  Email: {superadmin_email}")
            print(f"  Password: {'*' * len(superadmin_password)} (hidden)")
            print(f"  Role: superadmin")
            print(f"  ID: {superadmin.id}")
            if superadmin.id != 1:
                print(f"  ⚠️  WARNING: Superadmin ID is {superadmin.id}, not 1. This may cause issues.")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error creating superadmin: {e}")
            import traceback
            traceback.print_exc()
            raise

if __name__ == "__main__":
    create_superadmin()
