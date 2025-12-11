
import os
import sys
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.config import get_settings

def add_picture_column():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            # Check if column exists
            result = connection.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='picture'"
            ))
            if result.fetchone():
                print("Column 'picture' already exists in 'users' table.")
            else:
                print("Adding 'picture' column to 'users' table...")
                connection.execute(text("ALTER TABLE users ADD COLUMN picture VARCHAR(500)"))
                connection.commit()
                print("Successfully added 'picture' column.")
                
        except Exception as e:
            print(f"Error adding column: {e}")
            connection.rollback()

if __name__ == "__main__":
    add_picture_column()
