import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/dbname")

def migrate():
    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        # Check if guest_email column exists in api_usage
        print("Checking api_usage table...")
        result = connection.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='api_usage' AND column_name='guest_email'"
        ))
        if not result.fetchone():
            print("Adding guest_email column to api_usage...")
            connection.execute(text("ALTER TABLE api_usage ADD COLUMN guest_email VARCHAR(255)"))
            connection.execute(text("CREATE INDEX ix_api_usage_guest_email ON api_usage(guest_email)"))
            connection.commit()
            print("Done.")
        else:
            print("Column guest_email already exists in api_usage.")

        # Check if guest_email column exists in api_requests
        print("Checking api_requests table...")
        result = connection.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='api_requests' AND column_name='guest_email'"
        ))
        if not result.fetchone():
            print("Adding guest_email column to api_requests...")
            connection.execute(text("ALTER TABLE api_requests ADD COLUMN guest_email VARCHAR(255)"))
            connection.execute(text("CREATE INDEX ix_api_requests_guest_email ON api_requests(guest_email)"))
            connection.commit()
            print("Done.")
        else:
            print("Column guest_email already exists in api_requests.")

if __name__ == "__main__":
    migrate()
