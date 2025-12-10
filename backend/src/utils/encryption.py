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
        Encryption key as bytes (base64-encoded Fernet key)
        
    Raises:
        EncryptionError: If no key can be generated
    """
    # Try to get explicit encryption key
    encryption_key_env = os.getenv("MCP_APIKEY_ENCRYPTION_KEY")
    if encryption_key_env:
        # Strip any whitespace that might have been added
        encryption_key_env = encryption_key_env.strip()
        
        try:
            # Fernet keys are base64-encoded strings (44 characters)
            # Fernet expects the key as base64-encoded bytes, not decoded bytes
            if len(encryption_key_env) == 44:
                # Valid Fernet key format - convert string to bytes (keep base64-encoded)
                # Fernet can accept both str and bytes, but we need to ensure it's properly formatted
                try:
                    # Validate it's valid base64 by trying to decode and re-encode
                    decoded = base64.urlsafe_b64decode(encryption_key_env)
                    if len(decoded) == 32:
                        # Valid 32-byte key - return as base64-encoded bytes
                        return encryption_key_env.encode('utf-8')
                    else:
                        # Invalid length after decoding, derive from password
                        return _derive_key_from_password(encryption_key_env)
                except Exception:
                    # Invalid base64 format, derive from password
                    return _derive_key_from_password(encryption_key_env)
            else:
                # Not a valid Fernet key format (not 44 chars), use as password and derive key
                return _derive_key_from_password(encryption_key_env)
        except Exception as e:
            # If any error occurs, use it as password and derive key
            print(f"⚠️  Warning: Error processing MCP_APIKEY_ENCRYPTION_KEY: {e}. Deriving key from password.")
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
        # Ensure key is bytes (Fernet accepts both str and bytes)
        if isinstance(key, str):
            key = key.encode('utf-8')
        fernet = Fernet(key)
        encrypted = fernet.encrypt(value.encode())
        return encrypted.decode()
    except ValueError as e:
        # Fernet key validation error - provide helpful message
        error_msg = str(e)
        if "Fernet key must be 32 url-safe base64-encoded bytes" in error_msg:
            raise EncryptionError(
                "Invalid encryption key format. MCP_APIKEY_ENCRYPTION_KEY must be a valid Fernet key "
                "(44-character base64-encoded string). Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            ) from e
        raise EncryptionError(f"Failed to encrypt value: {error_msg}") from e
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
        # Only log warning if it's not a common decryption error (to reduce noise)
        error_str = str(e).lower()
        if "invalid token" not in error_str and "incorrect padding" not in error_str:
            # Only log if it's an unexpected error
            import logging
            logger = logging.getLogger(__name__)
            logger.debug(f"Failed to decrypt value (might be unencrypted): {str(e)}")
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

