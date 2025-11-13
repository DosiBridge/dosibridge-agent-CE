# Quick Setup Guide

This guide will help you get the project running locally using Docker Compose.

## Prerequisites

- Docker installed
- Docker Compose installed
- Git (to clone the repository)
- **PostgreSQL database** running externally (not included in docker-compose)

## Steps to Run

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <your-repo-url>
   cd agent-dosibridge
   ```

2. **Configure database URL** (if needed):
   - Edit `docker-compose.yml` and update `DATABASE_URL` if your PostgreSQL is different
   - Default: `postgresql://sazib:1234@host.docker.internal:5432/mcpagent`
   - Or set `DATABASE_URL` environment variable before running docker-compose

3. **Create the config directory** (optional, but recommended):
   ```bash
   mkdir -p config
   ```
   This directory will be used to persist backend configuration files.

4. **Start all services**:
   ```bash
   docker-compose up -d
   ```
   
   This will:
   - **First try to pull** pre-built images from Docker Hub (`dosibirdge/mcp-server:latest` and `dosibirdge/agent-frontend:latest`)
   - **If images don't exist** or can't be pulled, it will automatically build from local Dockerfiles
   - The `-d` flag runs containers in detached mode
   
   **Alternative options:**
   - To force pull latest images: `docker-compose pull && docker-compose up -d`
   - To force build locally: `docker-compose up --build -d`
   - To only build without starting: `docker-compose build`

5. **Check if services are running**:
   ```bash
   docker-compose ps
   ```

6. **View logs** (if needed):
   ```bash
   docker-compose logs -f
   ```

## Access the Application

- **Frontend**: http://localhost:8086
- **Backend API**: http://localhost:8085
- **Database**: Uses external PostgreSQL (configured via `DATABASE_URL` environment variable)

## Configuration

**docker-compose.yml contains default values that work out of the box.**

### To Customize Configuration

**Option 1: Edit docker-compose.yml directly**
- Open `docker-compose.yml` and modify the values in the `environment` section

**Option 2: Set environment variables before running docker-compose**
```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
export OPENAI_API_KEY="your-key"
docker-compose up -d
```

### Configuration Variables

- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://sazib:1234@host.docker.internal:5432/mcpagent`)
- `OPENAI_API_KEY`: For OpenAI API (optional, default: empty)
- `GOOGLE_API_KEY`: For Google Gemini API (optional, default: empty)
- `FIRECRAWL_API_KEY`: For Firecrawl API (optional, default: empty)
- `JWT_SECRET_KEY`: JWT secret for authentication (default: change in production!)
- `CORS_ORIGINS`: Comma-separated list of allowed origins (defaults provided)
- `NEXT_PUBLIC_API_BASE_URL`: Frontend backend URL (default: `http://localhost:8085`)

**Note**: For local development (running backend directly, not in Docker), create a `.env` file in the `backend/` directory with your `DATABASE_URL`.

## Troubleshooting

### Services won't start
- Check logs: `docker-compose logs`
- Make sure ports 8085, 8086, and 5432 are not in use
- Verify Docker is running: `docker ps`

### Frontend can't connect to backend
- Check backend is running: `curl http://localhost:8085/health`
- Verify CORS_ORIGINS in docker-compose.yml includes `http://localhost:8086`

### Database connection issues
- Verify your external PostgreSQL is running and accessible
- Check `DATABASE_URL` in `docker-compose.yml` matches your PostgreSQL configuration
- For Linux: Ensure `host.docker.internal` is accessible (already configured via `extra_hosts`)
- Test connection: `psql -h host.docker.internal -U sazib -d mcpagent` (from host machine)
- If PostgreSQL is on a different host, update `DATABASE_URL` in `docker-compose.yml` or set it as environment variable
- **Error "DATABASE_URL environment variable is required"**: Make sure `DATABASE_URL` is set in docker-compose.yml or as environment variable

## Stopping the Services

```bash
docker-compose down
```

To also remove volumes (this will delete database data):
```bash
docker-compose down -v
```

