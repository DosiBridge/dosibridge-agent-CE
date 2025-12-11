#!/usr/bin/env python
"""
Database Migration Management Script
Manages Alembic migrations for the database schema
"""
import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def run_migration_command(command: str, *args):
    """Run an Alembic migration command"""
    import subprocess
    
    cmd = ["alembic"] + command.split() + list(args)
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=backend_dir)
    return result.returncode == 0

def main():
    """Main migration management function"""
    if len(sys.argv) < 2:
        print("""
Database Migration Management

Usage:
    python migrate_db.py <command> [options]

Commands:
    init            - Initialize database (create all tables)
    create <name>   - Create a new migration file
    upgrade [revision] - Apply migrations (default: head)
    downgrade [revision] - Rollback migrations (default: -1)
    current         - Show current migration revision
    history         - Show migration history
    stamp <revision> - Mark database as being at a specific revision
    
Examples:
    python migrate_db.py init              # Initialize database
    python migrate_db.py create add_user_table
    python migrate_db.py upgrade           # Apply all pending migrations
    python migrate_db.py upgrade +1       # Apply next migration
    python migrate_db.py downgrade -1     # Rollback last migration
    python migrate_db.py current           # Show current revision
    python migrate_db.py history           # Show all migrations
        """)
        return
    
    command = sys.argv[1]
    
    if command == "init":
        # Initialize database using init_db
        print("Initializing database...")
        from src.core.database import init_db
        init_db()
        print("✓ Database initialized")
        
        # Stamp database with initial revision if migrations exist
        try:
            run_migration_command("stamp head")
            print("✓ Database stamped with current revision")
        except:
            print("⚠️  No migrations found, skipping stamp")
    
    elif command == "create":
        if len(sys.argv) < 3:
            print("Error: Migration name required")
            print("Usage: python migrate_db.py create <migration_name>")
            return
        migration_name = sys.argv[2]
        success = run_migration_command(f"revision --autogenerate -m {migration_name}")
        if success:
            print(f"✓ Migration '{migration_name}' created")
            print("  Review the migration file in alembic/versions/ before applying")
        else:
            print("❌ Failed to create migration")
    
    elif command == "upgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        success = run_migration_command(f"upgrade {revision}")
        if success:
            print(f"✓ Migrations upgraded to {revision}")
        else:
            print("❌ Migration upgrade failed")
    
    elif command == "downgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "-1"
        success = run_migration_command(f"downgrade {revision}")
        if success:
            print(f"✓ Migrations downgraded to {revision}")
        else:
            print("❌ Migration downgrade failed")
    
    elif command == "current":
        run_migration_command("current")
    
    elif command == "history":
        run_migration_command("history")
    
    elif command == "stamp":
        if len(sys.argv) < 3:
            print("Error: Revision required")
            print("Usage: python migrate_db.py stamp <revision>")
            return
        revision = sys.argv[2]
        success = run_migration_command(f"stamp {revision}")
        if success:
            print(f"✓ Database stamped at {revision}")
        else:
            print("❌ Failed to stamp database")
    
    else:
        print(f"Unknown command: {command}")
        print("Run 'python migrate_db.py' for help")

if __name__ == "__main__":
    main()

