#!/usr/bin/env python3
"""
Script to check if MCP API keys in the database are encrypted
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.core.database import get_db
from src.core.models import MCPServer
from src.utils.encryption import is_encrypted, decrypt_value, get_encryption_key
from cryptography.fernet import Fernet

def check_mcp_encryption():
    """Check encryption status of MCP API keys in database"""
    print("=" * 60)
    print("MCP API Key Encryption Status Check")
    print("=" * 60)
    print()
    
    # Check if encryption key is configured
    encryption_key = os.getenv("MCP_APIKEY_ENCRYPTION_KEY")
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    
    print("🔐 Encryption Configuration:")
    if encryption_key:
        print(f"   ✓ MCP_APIKEY_ENCRYPTION_KEY is set")
        print(f"   Key: {encryption_key[:20]}...{encryption_key[-10:]}")
    elif jwt_secret and jwt_secret != "your-secret-key-change-in-production-use-env-var":
        print(f"   ⚠️  MCP_APIKEY_ENCRYPTION_KEY not set, using JWT_SECRET_KEY")
        print(f"   Key derived from JWT_SECRET_KEY")
    else:
        print(f"   ❌ No encryption key found!")
        print(f"   ⚠️  MCP API keys will NOT be encrypted!")
        print()
        return
    
    print()
    
    # Get database session
    db = next(get_db())
    
    try:
        # Get all MCP servers
        servers = db.query(MCPServer).all()
        
        if not servers:
            print("📭 No MCP servers found in database")
            return
        
        print(f"📊 Found {len(servers)} MCP server(s) in database")
        print()
        
        encrypted_count = 0
        unencrypted_count = 0
        no_key_count = 0
        decryption_errors = 0
        
        for server in servers:
            print(f"Server: {server.name}")
            print(f"  URL: {server.url}")
            print(f"  User ID: {server.user_id}")
            
            if not server.api_key:
                print(f"  API Key: ❌ Not set")
                no_key_count += 1
            else:
                # Check if encrypted
                if is_encrypted(server.api_key):
                    print(f"  API Key: ✅ ENCRYPTED (starts with 'gAAAAAB')")
                    encrypted_count += 1
                    
                    # Try to decrypt to verify it works
                    try:
                        decrypted = decrypt_value(server.api_key)
                        if decrypted:
                            # Show first and last few characters
                            masked = decrypted[:4] + "..." + decrypted[-4:] if len(decrypted) > 8 else "***"
                            print(f"  Decrypted (masked): {masked}")
                            print(f"  ✓ Decryption successful")
                        else:
                            print(f"  ⚠️  Decryption returned None")
                    except Exception as e:
                        print(f"  ❌ Decryption failed: {str(e)}")
                        decryption_errors += 1
                else:
                    print(f"  API Key: ❌ NOT ENCRYPTED (stored in plain text)")
                    print(f"  Value (masked): {server.api_key[:4]}...{server.api_key[-4:] if len(server.api_key) > 8 else '***'}")
                    unencrypted_count += 1
            
            print()
        
        # Summary
        print("=" * 60)
        print("Summary:")
        print("=" * 60)
        print(f"  Total servers: {len(servers)}")
        print(f"  ✅ Encrypted: {encrypted_count}")
        print(f"  ❌ Unencrypted: {unencrypted_count}")
        print(f"  📭 No API key: {no_key_count}")
        if decryption_errors > 0:
            print(f"  ⚠️  Decryption errors: {decryption_errors}")
        print()
        
        if unencrypted_count > 0:
            print("⚠️  WARNING: Some API keys are NOT encrypted!")
            print("   To encrypt existing keys, update them through the API or UI.")
            print("   The set_api_key() method will automatically encrypt them.")
        elif encrypted_count > 0:
            print("✅ All API keys with values are encrypted!")
        
    except Exception as e:
        print(f"❌ Error checking encryption: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_mcp_encryption()

