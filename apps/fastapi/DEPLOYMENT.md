# FastAPI Deployment on Render

## Configuration Steps

### 1. Environment Variables

Set the following environment variables in your Render service dashboard:

- **Extraction provider (choose one):**
  - **OpenAI (default):** `OPENAI_API_KEY` - Your OpenAI API key. Uses `gpt-4o`.
  - **Gemini:** `EXTRACTION_PROVIDER=gemini` and `GOOGLE_API_KEY` - Your Google Gemini API key. Uses `gemini-2.5-flash`.
- `PORT` - Automatically set by Render (do not override)
- `CORS_ORIGIN` - Optional, defaults to "*" (set to your backend URL for production)

### 2. Build Command

In Render service settings, set:
```
pip install -r requirements.txt
```

### 3. Start Command

Use one of these options:

**Option 1: Use the startup script (recommended)**
```
chmod +x start.sh && ./start.sh
```

**Option 2: Direct uvicorn command**
```
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1 --timeout-keep-alive 75
```

### 4. Health Check Path

Set the health check path in Render:
```
/health
```

This endpoint returns a simple JSON status for Render's health monitoring.

## Common Issues

### 502 Bad Gateway

This error typically occurs when:

1. **Request Timeout**: Render has a default 60-second timeout for web services. If PDF processing takes longer, you'll get a 502.

   **Solution**: 
   - The timeout has been increased to 75 seconds in the startup script
   - For longer processing, consider implementing async processing with a queue
   - Monitor Render logs to see actual processing time

2. **Service Not Running**: FastAPI service crashed or failed to start.

   **Solution**: 
   - Check Render logs for startup errors
   - Verify `OPENAI_API_KEY` (openai) or `GOOGLE_API_KEY` (gemini) is set correctly for your chosen provider
   - Ensure all dependencies are installed

3. **Incorrect URL**: Backend is using wrong FastAPI URL.

   **Solution**: 
   - In Backend service, set `FASTAPI_URL` environment variable to your FastAPI service URL
   - Example: `https://your-fastapi-service.onrender.com`
   - Ensure there's no trailing slash

4. **Port/Host Binding**: FastAPI not binding to correct host/port.

   **Solution**: 
   - Use the provided `start.sh` script which binds to `0.0.0.0` and uses `$PORT`
   - Or use the uvicorn command above

## Backend Configuration

In your Backend service on Render, set:

- `FASTAPI_URL` - Full URL to your FastAPI service (e.g., `https://your-fastapi-service.onrender.com`)
- `FASTAPI_TIMEOUT_MS` - Optional, defaults to 600000 (10 minutes)

**Important**: The backend timeout should be longer than Render's load balancer timeout, but if Render times out at 60-75 seconds, the backend timeout won't matter.

## Monitoring

Check logs in Render dashboard:
- FastAPI service logs will show detailed processing information
- Backend service logs will show connection attempts and errors

## Testing

Test the FastAPI service directly:
```bash
curl https://your-fastapi-service.onrender.com/health
```

Should return:
```json
{"status": "healthy", "service": "FastAPI Invoice Extraction"}
```

