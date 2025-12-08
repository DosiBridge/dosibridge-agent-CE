# API Usage Monitoring & Rate Limiting

## Overview

The system now includes comprehensive API usage monitoring and daily rate limiting (100 requests per day per user).

## Features Implemented

### 1. Daily Rate Limiting
- **Limit**: 100 requests per day per user
- **Enforcement**: Applied to both `/api/chat` and `/api/chat/stream` endpoints
- **Error Response**: Returns HTTP 429 with clear error message when limit is exceeded
- **Frontend Check**: Pre-checks usage before sending requests (shows warning at 10 remaining)

### 2. Usage Tracking
- **Database Model**: `APIUsage` table tracks:
  - Request count per day
  - Input/output/embedding tokens
  - LLM provider and model used
  - Chat mode (agent/rag)
- **Automatic Tracking**: Usage is recorded after each successful chat response

### 3. Monitoring Page (`/monitoring`)
- **Today's Usage**: Shows current usage, remaining requests, and token breakdown
- **API Keys Status**: Displays which API keys are configured and their purposes
- **Usage History**: Table showing daily usage for the last 7/14/30 days
- **Visual Indicators**: Color-coded warnings when near limit

### 4. Usage Indicator
- **Header Widget**: Shows remaining requests in chat header (e.g., "85/100")
- **Color Coding**: 
  - Green: Normal usage
  - Amber: Near limit (80%+)
  - Red: Limit exceeded
- **Clickable**: Links to full monitoring page

## Database Schema

### `api_usage` Table
```sql
CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    usage_date TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 0 NOT NULL,
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    input_tokens INTEGER DEFAULT 0 NOT NULL,
    output_tokens INTEGER DEFAULT 0 NOT NULL,
    embedding_tokens INTEGER DEFAULT 0 NOT NULL,
    mode VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, usage_date)
);
```

## API Endpoints

### `GET /api/usage/stats?days=7`
Get usage statistics for the current user.

**Response:**
```json
{
  "status": "success",
  "data": {
    "today": {
      "request_count": 45,
      "remaining": 55,
      "limit": 100,
      "input_tokens": 12000,
      "output_tokens": 15000,
      "embedding_tokens": 5000,
      "llm_provider": "deepseek",
      "llm_model": "deepseek-chat"
    },
    "recent_days": [...],
    "total_requests": 320,
    "total_tokens": 125000
  }
}
```

### `GET /api/usage/today`
Get today's usage and remaining requests.

**Response:**
```json
{
  "status": "success",
  "data": {
    "request_count": 45,
    "remaining": 55,
    "limit": 100,
    "is_allowed": true,
    "input_tokens": 12000,
    "output_tokens": 15000,
    "embedding_tokens": 5000,
    "total_tokens": 32000,
    "llm_provider": "deepseek",
    "llm_model": "deepseek-chat"
  }
}
```

### `GET /api/usage/keys`
Get information about which API keys are being used (requires authentication).

**Response:**
```json
{
  "status": "success",
  "data": {
    "active_provider": "deepseek",
    "active_model": "deepseek-chat",
    "keys_configured": {
      "openai": {
        "set": true,
        "purpose": "Embeddings only (RAG system)",
        "used_for": "Document embeddings and vector search"
      },
      "deepseek": {
        "set": true,
        "purpose": "LLM responses (agent and RAG)",
        "used_for": "Chat responses and agent interactions"
      },
      ...
    },
    "today_usage": {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "input_tokens": 12000,
      "output_tokens": 15000,
      "embedding_tokens": 5000
    }
  }
}
```

## Implementation Details

### Backend

1. **Usage Tracker Service** (`backend/src/services/usage_tracker.py`)
   - `check_daily_limit()`: Checks if user has exceeded daily limit
   - `record_request()`: Records API usage after successful requests
   - `get_user_usage_stats()`: Retrieves usage statistics

2. **Rate Limiting in Chat Endpoints**
   - Checks limit before processing request
   - Records usage after successful response
   - Returns 429 error when limit exceeded

3. **Database Migration**
   - Automatically creates `api_usage` table on startup
   - Handles existing databases gracefully

### Frontend

1. **Monitoring Page** (`frontend/app/monitoring/page.tsx`)
   - Full-featured monitoring dashboard
   - Real-time usage statistics
   - API keys information
   - Historical usage data

2. **Usage Indicator** (`frontend/components/UsageIndicator.tsx`)
   - Compact header widget
   - Auto-refreshes every 30 seconds
   - Color-coded status

3. **Pre-flight Checks** (`frontend/components/ChatInput.tsx`)
   - Checks usage before sending request
   - Shows warnings when near limit
   - Blocks requests when limit exceeded

## Configuration

### Daily Limit
The daily limit is configured in `backend/src/core/constants.py`:
```python
DAILY_REQUEST_LIMIT = 100  # Maximum requests per user per day
```

To change the limit, update this constant and restart the backend.

## Usage Flow

1. **User sends message** → Frontend checks usage (if authenticated)
2. **Backend receives request** → Checks daily limit
3. **If allowed** → Processes request and records usage
4. **If exceeded** → Returns 429 error with helpful message
5. **Frontend displays** → Usage indicator updates, monitoring page shows details

## Notes

- **Anonymous Users**: Rate limiting applies but tracking is limited (user_id is NULL)
- **Token Estimation**: Current implementation uses rough token estimates (words * 2)
- **Timezone**: Usage dates are normalized to UTC start of day
- **Reset**: Daily limit resets at midnight UTC

## Future Enhancements

- More accurate token counting using actual LLM response metadata
- Admin dashboard for viewing all users' usage
- Configurable limits per user tier
- Usage alerts/notifications
- Export usage data

