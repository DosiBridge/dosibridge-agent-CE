#!/usr/bin/env python3
"""
Generate a valid Fernet encryption key for MCP_APIKEY_ENCRYPTION_KEY

Usage:
    python generate_encryption_key.py

This will output a valid Fernet key that can be used as MCP_APIKEY_ENCRYPTION_KEY
in your environment variables or docker-compose.yml
"""
from cryptography.fernet import Fernet

if __name__ == "__main__":
    key = Fernet.generate_key()
    print("=" * 60)
    print("Generated Fernet Encryption Key:")
    print("=" * 60)
    print(key.decode())
    print("=" * 60)
    print("\nAdd this to your docker-compose.yml or .env file:")
    print(f'MCP_APIKEY_ENCRYPTION_KEY="{key.decode()}"')
    print("\nOr set as environment variable:")
    print(f'export MCP_APIKEY_ENCRYPTION_KEY="{key.decode()}"')
    print("=" * 60)

