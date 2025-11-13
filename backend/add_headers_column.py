#!/usr/bin/env python3
"""
Quick migration script to add headers column to mcp_servers table
Run this if you need to add the column without restarting the server
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.core.database import engine, DB_AVAILABLE
from sqlalchemy import text

if __name__ == "__main__":
    if not DB_AVAILABLE or not engine:
        print("❌ Database is not available")
        sys.exit(1)
    
    try:
        with engine.connect() as conn:
            # Check if headers column exists
            result = conn.execute(
                text("SELECT column_name FROM information_schema.columns "
                     "WHERE table_name='mcp_servers' AND column_name='headers'")
            )
            if result.fetchone():
                print("✓ Headers column already exists in mcp_servers table")
            else:
                print("📝 Adding headers column to mcp_servers table...")
                conn.execute(
                    text("ALTER TABLE mcp_servers ADD COLUMN headers TEXT")
                )
                conn.commit()
                print("✓ Successfully added headers column to mcp_servers table")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

