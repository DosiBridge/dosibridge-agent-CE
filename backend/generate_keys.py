#!/usr/bin/env python3
"""
Generate secure keys for JWT_SECRET_KEY and MCP_APIKEY_ENCRYPTION_KEY
"""

import secrets
import sys
import base64

try:
    from cryptography.fernet import Fernet
    CRYPTOGRAPHY_AVAILABLE = True
except ImportError:
    CRYPTOGRAPHY_AVAILABLE = False


def generate_jwt_secret() -> str:
    """Generate a secure random JWT secret key (32 bytes hex)"""
    return secrets.token_hex(32)


def generate_encryption_key() -> str:
    """Generate a Fernet encryption key for MCP API keys"""
    if CRYPTOGRAPHY_AVAILABLE:
        return Fernet.generate_key().decode()
    else:
        # Fallback: generate a 32-byte key and base64 encode it
        # This will work with Fernet if the key is properly formatted
        key_bytes = secrets.token_bytes(32)
        # Fernet keys are base64-encoded 32-byte keys
        return base64.urlsafe_b64encode(key_bytes).decode()


def main():
    """Generate and display keys"""
    print("=" * 60)
    print("🔐 Generating Secure Keys")
    print("=" * 60)
    print()
    
    # Generate JWT secret
    jwt_secret = generate_jwt_secret()
    print("JWT_SECRET_KEY:")
    print(f"  {jwt_secret}")
    print()
    
    # Generate encryption key
    encryption_key = generate_encryption_key()
    print("MCP_APIKEY_ENCRYPTION_KEY:")
    print(f"  {encryption_key}")
    print()
    
    print("=" * 60)
    print("📝 Add these to your .env file:")
    print("=" * 60)
    print()
    print(f"JWT_SECRET_KEY={jwt_secret}")
    print(f"MCP_APIKEY_ENCRYPTION_KEY={encryption_key}")
    print()
    
    # Optionally write to .env file if it exists
    try:
        with open('.env', 'r') as f:
            env_content = f.read()
        
        # Check if keys already exist
        has_jwt = 'JWT_SECRET_KEY=' in env_content
        has_encryption = 'MCP_APIKEY_ENCRYPTION_KEY=' in env_content
        
        if has_jwt or has_encryption:
            print("⚠️  Warning: .env file already contains these keys.")
            print("   Please update them manually or remove old values first.")
            return
        
        # Ask user if they want to append
        response = input("Do you want to append these to .env file? (y/n): ").strip().lower()
        if response == 'y':
            with open('.env', 'a') as f:
                f.write(f"\n# Generated keys\n")
                f.write(f"JWT_SECRET_KEY={jwt_secret}\n")
                f.write(f"MCP_APIKEY_ENCRYPTION_KEY={encryption_key}\n")
            print("✅ Keys added to .env file")
        else:
            print("📋 Copy the keys above to your .env file manually")
    except FileNotFoundError:
        print("📋 .env file not found. Copy the keys above to your .env file")
    except Exception as e:
        print(f"⚠️  Could not write to .env file: {e}")
        print("📋 Copy the keys above to your .env file manually")


if __name__ == "__main__":
    main()

