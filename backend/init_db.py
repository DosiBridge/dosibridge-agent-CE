#!/usr/bin/env python3
"""
Initialize database and migrate data from JSON files
Run this script once to set up the database and migrate existing data
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.core import init_db
from src.utils.migrate_to_db import main as migrate_main

if __name__ == "__main__":
    print("🔄 Initializing database...")
    init_db()
    print("\n🔄 Migrating data from JSON files...")
    migrate_main()

