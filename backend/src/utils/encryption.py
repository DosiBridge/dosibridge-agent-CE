"""
Encryption utilities for sensitive data (e.g., MCP API keys)
Uses Fernet symmetric encryption from cryptography library
"""
import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class EncryptionError(Exception):
    """Raised when encryption/decryption fails"""
    pass


def get_encryption_key() -> bytes:
    """
    Get or generate encryption key from environment variable.
    
    If MCP_APIKEY_ENCRYPTION_KEY is set, use it.
    Otherwise, generate a key from JWT_SECRET_KEY using PBKDF2.
    
    Returns:
        Encryption key as bytes
        
    Raises:
        EncryptionError: If no key can be generated
    """
    # Try to get explicit encryption key
    encryption_key_env = os.getenv("MCP_APIKEY_ENCRYPTION_KEY")
    if encryption_key_env:
        try:
            # Try to decode as base64 (Fernet key format)
            return encryption_key_env.encode()
        except Exception:
            # If not base64, use it as password and derive key
            return _derive_key_from_password(encryption_key_env)
    
    # Fallback: derive from JWT_SECRET_KEY
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if jwt_secret and jwt_secret != "your-secret-key-change-in-production-use-env-var":
        return _derive_key_from_password(jwt_secret)
    
    # Last resort: generate a key (not recommended for production)
    print("⚠️  Warning: No encryption key found. Generating a temporary key.")
    print("   This key will change on restart - encrypted data will be lost!")
    print("   Set MCP_APIKEY_ENCRYPTION_KEY environment variable for persistent encryption.")
    return Fernet.generate_key()


def _derive_key_from_password(password: str) -> bytes:
    """
    Derive a Fernet key from a password using PBKDF2.
    
    Args:
        password: Password string
        
    Returns:
        Fernet-compatible key (32 bytes, base64-encoded)
    """
    # Use a fixed salt (in production, you might want to store this separately)
    # For MCP API keys, using a fixed salt is acceptable since we're encrypting
    # per-field, not per-record
    salt = b"mcp_apikey_salt_v1"  # Fixed salt for consistency
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key


def encrypt_value(value: str) -> Optional[str]:
    """
    Encrypt a string value using Fernet.
    
    Args:
        value: String to encrypt
        
    Returns:
        Encrypted string (base64-encoded), or None if value is None/empty
        
    Raises:
        EncryptionError: If encryption fails
    """
    if not value:
        return None
    
    try:
        key = get_encryption_key()
        fernet = Fernet(key)
        encrypted = fernet.encrypt(value.encode())
        return encrypted.decode()
    except Exception as e:
        raise EncryptionError(f"Failed to encrypt value: {str(e)}") from e


def decrypt_value(encrypted_value: Optional[str]) -> Optional[str]:
    """
    Decrypt a string value using Fernet.
    
    Args:
        encrypted_value: Encrypted string (base64-encoded)
        
    Returns:
        Decrypted string, or None if encrypted_value is None/empty
        
    Raises:
        EncryptionError: If decryption fails
    """
    if not encrypted_value:
        return None
    
    try:
        key = get_encryption_key()
        fernet = Fernet(key)
        decrypted = fernet.decrypt(encrypted_value.encode())
        return decrypted.decode()
    except Exception as e:
        # If decryption fails, it might be an old unencrypted value
        # Try to return as-is (for backward compatibility during migration)
        print(f"⚠️  Warning: Failed to decrypt value (might be unencrypted): {str(e)}")
        # Return the value as-is - might be unencrypted from before encryption was added
        return encrypted_value


def is_encrypted(value: Optional[str]) -> bool:
    """
    Check if a value appears to be encrypted.
    
    Args:
        value: Value to check
        
    Returns:
        True if value appears to be encrypted, False otherwise
    """
    if not value:
        return False
    
    # Fernet-encrypted values are base64-encoded and have a specific format
    # They start with 'gAAAAAB' (Fernet token header)
    try:
        return value.startswith('gAAAAAB')
    except Exception:
        return False

