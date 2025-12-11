"""
Script to create/promote superadmin user
Run this script to promote an Auth0 user to superadmin.
Email is read from environment variable:
- SUPERADMIN_EMAIL (default: super@mail.com)
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

def create_superadmin():
    """
    Promote user to superadmin. 
    If user exists (from Auth0 login), updates role.
    If not, creates placeholder user with that email.
    """
    # Get email from environment variables
    superadmin_email = os.getenv("SUPERADMIN_EMAIL", "super@mail.com")
    
    if not superadmin_email:
        print("❌ Error: SUPERADMIN_EMAIL must be set")
        print("   Set it in .env file or as environment variable")
        return
    
    print(f"🔧 Configuring superadmin for: {superadmin_email}")
    
    with get_db_context() as db:
        try:
            # Check if user with this email already exists
            user = db.query(User).filter(User.email == superadmin_email).first()
            
            if user:
                # User exists - promote to superadmin
                if hasattr(user, 'role') and user.role == "superadmin":
                    print(f"✓ User {superadmin_email} (ID={user.id}) is already a superadmin.")
                else:
                    user.role = "superadmin"
                    user.is_active = True
                    db.commit()
                    print(f"✓ Promoted existing user {superadmin_email} (ID={user.id}) to superadmin.")
            else:
                # User doesn't exist - create placeholder for Auth0
                # When they log in via Auth0, the system will match by email
                print(f"ℹ️  User {superadmin_email} not found in database.")
                print(f"   Creating placeholder user. They will become superadmin when they log in via Auth0.")
                
                # Check if we can use ID=1 (nice to have but not required)
                user_id_1 = db.query(User).filter(User.id == 1).first()
                if not user_id_1:
                    # Try to create with ID=1
                    try:
                        from sqlalchemy import text
                        db.execute(
                            text("INSERT INTO users (id, email, name, role, is_active) VALUES (1, :email, :name, :role, :is_active)"),
                            {
                                "email": superadmin_email,
                                "name": "Super Admin Pending",
                                "role": "superadmin",
                                "is_active": True
                            }
                        )
                        db.commit()
                        print(f"✓ Created placeholder superadmin with ID=1.")
                        
                        # Update sequence to avoid conflicts
                        try:
                            # Update the sequence to start from 2 (since we have ID=1 now)
                            db.execute(text("SELECT setval('users_id_seq', GREATEST(1, (SELECT MAX(id) FROM users)))"))
                            db.commit()
                        except Exception:
                            pass # Sequence update might fail on some DBs, ignore
                            
                        return
                    except Exception as e:
                        print(f"   Could not force ID=1: {e}")
                        db.rollback()
                
                # Create standard user
                new_user = User(
                    email=superadmin_email,
                    name="Super Admin Pending",
                    role="superadmin",
                    is_active=True
                )
                db.add(new_user)
                db.commit()
                print(f"✓ Created placeholder superadmin for {superadmin_email}.")

        except Exception as e:
            db.rollback()
            print(f"❌ Error configuring superadmin: {e}")
            import traceback
            traceback.print_exc()
            raise

if __name__ == "__main__":
    create_superadmin()
