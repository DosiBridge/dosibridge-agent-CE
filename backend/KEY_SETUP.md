# 🔐 Setting Up Security Keys

This guide explains how to generate and set up the required security keys for the application.

## Required Keys

1. **JWT_SECRET_KEY** - Used for signing JWT authentication tokens
2. **MCP_APIKEY_ENCRYPTION_KEY** - Used for encrypting MCP server API keys in the database

## Quick Setup

### Option 1: Use the Key Generation Script (Recommended)

```bash
cd backend
python3 generate_keys.py
```

This will generate both keys and display them. You can then:
- Copy them to your `.env` file manually
- Or let the script append them (if `.env` doesn't already have these keys)

### Option 2: Generate Keys Manually

#### JWT_SECRET_KEY

```bash
# Using Python
python3 -c 'import secrets; print(secrets.token_hex(32))'

# Or using OpenSSL
openssl rand -hex 32
```

#### MCP_APIKEY_ENCRYPTION_KEY

```bash
# Using Python (requires cryptography package)
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'

# Or using the generate_keys.py script
python3 backend/generate_keys.py
```

## Adding Keys to .env File

1. Create or edit `.env` file in the project root:

```bash
cp .env.example .env
```

2. Add the generated keys:

```env
JWT_SECRET_KEY=your-generated-jwt-secret-key-here
MCP_APIKEY_ENCRYPTION_KEY=your-generated-encryption-key-here
```

## Example .env File

```env
# Database Configuration
DATABASE_URL="postgresql://sazib:1234@localhost:5432/mcpagent"

# JWT Authentication Secret Key
JWT_SECRET_KEY=8c56b409bc68b35521de73f1fcc15e08bbf66731e0d508f01b9c87558f84699e

# MCP API Key Encryption Key
MCP_APIKEY_ENCRYPTION_KEY=YdkUR2jCzzix9s-ZZUlZCh5ywg7vP_r8O6KUNfwV-gs=

# CORS Origins
CORS_ORIGINS="http://localhost:3000,http://localhost:8086"

# LLM API Keys (Optional)
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
GROQ_API_KEY=""

# Environment
ENVIRONMENT="development"
```

## Important Notes

### Development Mode
- In development, `JWT_SECRET_KEY` can use a default value (but it's still recommended to set a real one)
- `MCP_APIKEY_ENCRYPTION_KEY` is optional in development, but **highly recommended**

### Production Mode
- **Both keys are REQUIRED in production**
- Never use default values in production
- Never commit `.env` file to version control
- Use different keys for each environment (dev, staging, production)
- Store keys securely (use environment variables or secret management services)

## Security Best Practices

1. **Never commit keys to Git**
   - `.env` is already in `.gitignore`
   - Always use `.env.example` as a template

2. **Use strong, random keys**
   - JWT_SECRET_KEY: At least 32 bytes (64 hex characters)
   - MCP_APIKEY_ENCRYPTION_KEY: Must be a valid Fernet key (44 base64 characters)

3. **Rotate keys periodically**
   - If a key is compromised, generate a new one
   - Note: Rotating `MCP_APIKEY_ENCRYPTION_KEY` will make existing encrypted data unreadable

4. **Use different keys per environment**
   - Development, staging, and production should have different keys

5. **Store keys securely**
   - Use environment variables
   - Use secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Never hardcode keys in source code

## Troubleshooting

### "JWT_SECRET_KEY is required" error
- Make sure you've set `JWT_SECRET_KEY` in your `.env` file
- Or set it as an environment variable: `export JWT_SECRET_KEY=your-key`

### "MCP_APIKEY_ENCRYPTION_KEY not set" warning
- This is a warning, not an error
- In development, the app will work but MCP API keys won't be encrypted
- Generate a key using `python3 backend/generate_keys.py`

### Keys not working after generation
- Make sure you copied the entire key (no extra spaces or newlines)
- Check that your `.env` file is in the correct location (project root)
- Restart the server after adding keys

## Verification

After setting up keys, verify they're loaded correctly:

```bash
# Start the server
./start_server.sh

# Look for these messages:
# ✅ Environment validation passed (with warnings)
# ✓ MCP API key encryption enabled.
```

If you see warnings about missing keys, check your `.env` file and restart the server.

