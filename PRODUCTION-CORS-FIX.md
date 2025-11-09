# Production CORS Fix for agent.dosibridge.com

## Current Issue

- **Frontend**: `https://agent.dosibridge.com`
- **Backend API**: `https://agentapi.dosibridge.com`
- **Error**: CORS policy blocking + 502 Bad Gateway

## Root Causes

1. **502 Bad Gateway**: Backend not accessible at `https://agentapi.dosibridge.com`
   - Backend container might not be running
   - Reverse proxy (Nginx/Apache) not configured correctly
   - Backend crashed or not started

2. **CORS Error**: Even if backend is reachable, CORS headers not being set
   - Backend needs `CORS_ORIGINS` environment variable
   - Reverse proxy might be stripping CORS headers
   - Backend needs restart after CORS_ORIGINS change

## Solution Steps

### Step 1: Update docker-compose.yml

Your `CORS_ORIGINS` should include `https://agent.dosibridge.com`:

```yaml
CORS_ORIGINS: "https://agent.dosibridge.com,http://160.191.163.85:8086,http://localhost:8086,http://127.0.0.1:8086"
```

### Step 2: Restart Backend Container

After updating `CORS_ORIGINS`, restart the backend:

```bash
cd /path/to/your/project
docker-compose restart agent-backend

# OR if that doesn't work, recreate:
docker-compose up -d --force-recreate agent-backend
```

### Step 3: Verify Backend is Running

```bash
# Check if container is running
docker ps | grep agent-backend

# Check backend logs
docker logs agent-backend --tail 50

# Test backend directly (bypass reverse proxy)
curl http://localhost:8085/health

# Test with CORS headers
curl -H "Origin: https://agent.dosibridge.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8085/api/sessions \
     -v
```

You should see `Access-Control-Allow-Origin: https://agent.dosibridge.com` in the response.

### Step 4: Configure Reverse Proxy (Nginx)

If you're using Nginx as a reverse proxy for `https://agentapi.dosibridge.com`, you need to:

1. **Pass CORS headers from backend** (don't override them)
2. **Handle OPTIONS preflight requests**

Example Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name agentapi.dosibridge.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Proxy to backend
    location / {
        # Don't override CORS headers - let backend handle them
        proxy_pass http://localhost:8085;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Important: Don't add CORS headers here if backend already does
        # The backend will set CORS headers based on CORS_ORIGINS
    }

    # Handle OPTIONS preflight requests
    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $http_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
```

**OR** simpler approach - let backend handle everything:

```nginx
server {
    listen 443 ssl http2;
    server_name agentapi.dosibridge.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8085;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Don't add any CORS headers - backend handles it
    }
}
```

### Step 5: Verify Environment Variable is Set

Check if the backend container has the correct CORS_ORIGINS:

```bash
docker exec agent-backend env | grep CORS_ORIGINS
```

Should output:
```
CORS_ORIGINS=https://agent.dosibridge.com,http://160.191.163.85:8086,http://localhost:8086,http://127.0.0.1:8086
```

### Step 6: Test from Browser Console

Open browser console on `https://agent.dosibridge.com` and test:

```javascript
fetch('https://agentapi.dosibridge.com/health', {
  method: 'GET',
  credentials: 'include'
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Troubleshooting

### If 502 persists:

1. **Check backend container**:
   ```bash
   docker ps -a | grep agent-backend
   docker logs agent-backend
   ```

2. **Check if port 8085 is accessible**:
   ```bash
   netstat -tlnp | grep 8085
   # OR
   ss -tlnp | grep 8085
   ```

3. **Check reverse proxy logs**:
   ```bash
   # Nginx
   tail -f /var/log/nginx/error.log
   
   # Apache
   tail -f /var/log/apache2/error.log
   ```

### If CORS still fails after backend restart:

1. **Verify CORS_ORIGINS in container**:
   ```bash
   docker exec agent-backend printenv CORS_ORIGINS
   ```

2. **Check backend logs for CORS errors**:
   ```bash
   docker logs agent-backend | grep -i cors
   ```

3. **Test backend directly** (bypass reverse proxy):
   ```bash
   curl -H "Origin: https://agent.dosibridge.com" \
        -X OPTIONS \
        http://localhost:8085/api/sessions \
        -v
   ```

4. **Check if reverse proxy is overriding CORS headers**:
   - Remove any `add_header 'Access-Control-*'` from Nginx config
   - Let the backend handle CORS completely

## Quick Fix Command

```bash
# 1. Update docker-compose.yml with correct CORS_ORIGINS
# 2. Restart backend
docker-compose restart agent-backend

# 3. Verify
docker logs agent-backend --tail 20
curl -H "Origin: https://agent.dosibridge.com" http://localhost:8085/health -v
```

## Important Notes

1. **Exact Match**: Origin must match exactly (including `https://` not `http://`)
2. **No Trailing Slash**: Don't include trailing slashes in origins
3. **Restart Required**: Backend must be restarted after changing `CORS_ORIGINS`
4. **Reverse Proxy**: If using reverse proxy, don't override CORS headers - let backend handle it
5. **502 Error**: Usually means backend isn't running or reverse proxy can't reach it

