# Docker Deployment Guide

This guide explains how to deploy the MCP Agent application on your Linux VPS using Docker Compose.

## Prerequisites

- Docker installed on your VPS
- Docker Compose installed
- Ports 3000 and 8000 available (or configure different ports)

## Quick Start

1. **Clone or download the repository** (or just the docker-compose.yml file)

2. **Create a `.env` file** (optional, for API keys):
   ```bash
   cp .env.example .env
   nano .env  # Edit with your API keys if needed
   ```

3. **Create config directory** (for backend configuration persistence):
   ```bash
   mkdir -p config
   ```

4. **Pull and start services**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

5. **Check status**:
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

## Services

- **Backend API**: Available at `http://your-server-ip:8000`
- **Frontend**: Available at `http://your-server-ip:3000`

## Configuration

### Backend Configuration

The backend uses configuration files in the `./config` directory:
- `config/llm_config.json` - LLM model configuration
- `config/mcp_servers.json` - MCP server configuration

These files are persisted in a volume, so changes survive container restarts.

### Frontend Configuration

Set `NEXT_PUBLIC_API_BASE_URL` in `.env` file to point to your backend:
- Same server: `http://localhost:8000` or `http://your-server-ip:8000`
- Different domain: `https://api.yourdomain.com`

**Important**: If you change `NEXT_PUBLIC_API_BASE_URL`, you need to rebuild the frontend image since Next.js embeds this at build time.

## Environment Variables

Create a `.env` file with these variables (all optional):

```env
# Backend API Keys (optional - can be set via UI or config files)
OPENAI_API_KEY=your_key_here
FIRECRAWL_API_KEY=your_key_here

# CORS Configuration - comma-separated list of allowed origins
# Examples:
# - "http://localhost:3000,http://localhost:3001" (multiple local)
# - "http://your-vps-ip:3000" (single IP address)
# - "https://yourdomain.com,https://www.yourdomain.com" (production domains)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Frontend Backend URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### CORS Configuration

The `CORS_ORIGINS` environment variable controls which origins can access the backend API. This is important for security and to prevent CORS errors.

**For local development:**
```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**For VPS deployment (using IP address):**
```env
CORS_ORIGINS=http://your-vps-ip:3000
```

**For production with domain:**
```env
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Important**: 
- Do NOT use wildcard `*` when `allow_credentials=True` (browsers block this)
- Always include the exact protocol (http:// or https://)
- Include port numbers if not using standard ports (80/443)

## Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f mcp-server
docker-compose logs -f mcp-frontend

# Restart a service
docker-compose restart mcp-server

# Pull latest images
docker-compose pull

# Update and restart
docker-compose pull && docker-compose up -d

# Check service health
docker-compose ps
```

## Troubleshooting

### Services won't start
- Check logs: `docker-compose logs`
- Verify ports are available: `netstat -tulpn | grep -E '3000|8000'`
- Check Docker is running: `docker ps`

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check backend is running: `curl http://localhost:8000/health`
- Check firewall allows connections on ports 3000 and 8000
- **CORS errors**: Verify `CORS_ORIGINS` includes your frontend URL (exact match required)
  - Check browser console for CORS error messages
  - Ensure protocol (http/https) and port match exactly

### Configuration not persisting
- Ensure `./config` directory exists and is writable
- Check volume mounts: `docker-compose config`

## Production Recommendations

1. **Use a reverse proxy** (nginx/traefik) for:
   - SSL/TLS termination
   - Domain routing
   - Rate limiting

2. **Set up firewall**:
   ```bash
   # Allow only necessary ports
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP (if using reverse proxy)
   ufw allow 443/tcp   # HTTPS (if using reverse proxy)
   ```

3. **Use environment variables** instead of hardcoding secrets

4. **Set up log rotation** for Docker logs

5. **Monitor services** with healthchecks (already configured)

6. **Backup config directory** regularly:
   ```bash
   tar -czf config-backup-$(date +%Y%m%d).tar.gz config/
   ```

