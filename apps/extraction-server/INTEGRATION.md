# Extraction Server Integration Guide

## Overview

The extraction server is a Node.js/TypeScript service that extracts structured data from Purchase Order documents (PDF/Excel) using OpenAI's GPT-4o-mini model. It replaces the FastAPI extraction service and integrates seamlessly with the existing backend.

## Architecture

```
Website (Frontend)
    ↓
Backend (Express)
    ↓
Extraction Server (Node.js/Express) ← OpenAI API
    ↓
Returns ExtractedPO Data
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/extraction-server
npm install
```

### 2. Configure Environment Variables

Create `.env` file in `apps/extraction-server/`:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=8001
NODE_ENV=development
CORS_ORIGIN=*
```

### 3. Update Backend Configuration

In `apps/backend/.env`, add:

```env
# Use extraction-server (recommended)
EXTRACTION_SERVER_URL=http://localhost:8001

# OR continue using FastAPI (legacy)
# FASTAPI_URL=http://localhost:8000

# Timeout for extraction requests (default: 10 minutes)
EXTRACTION_TIMEOUT_MS=600000
```

**Note:** `EXTRACTION_SERVER_URL` takes precedence over `FASTAPI_URL`. If neither is set, it defaults to `http://localhost:8001`.

### 4. Start the Extraction Server

Development mode:
```bash
cd apps/extraction-server
npm run dev
```

Production mode:
```bash
cd apps/extraction-server
npm run build
npm start
```

The server will start on `http://localhost:8001` (or the port specified in `.env`).

## API Endpoint

### POST `/extract-invoice`

Extracts Purchase Order data from uploaded file.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: PDF or Excel file (required)
- `client_name`: Client name hint (optional)
- `mapping_text`: Client field mapping rules (optional)
- `expected_items`: Expected number of items (optional)

**Response:**
```typescript
{
  total_value: number | null;
  client_name: string;
  invoice_number: string;
  invoice_date: string;
  total_entries: number;
  items: ExtractedLine[];
}
```

## Backend Integration

The backend has been updated to use `extractionService` instead of `fastapiService`. The service automatically detects which extraction server to use based on environment variables:

1. **Priority 1:** `EXTRACTION_SERVER_URL` → Uses extraction-server
2. **Priority 2:** `FASTAPI_URL` → Uses FastAPI (legacy)
3. **Default:** `http://localhost:8001` → Uses extraction-server

### Code Changes

The backend controller (`apps/backend/src/controllers/po.controller.ts`) now uses:

```typescript
import { extractionService } from '../services/extraction.service';

// In uploadPO function:
const extraction = await extractionService.extractPurchaseOrder(file, {
  clientName: selectedClientName ?? undefined,
  mappingText: mappingText ?? undefined,
  expectedItems,
});
```

## Features

### ✅ Large File Support
- Handles PDFs up to 30-40MB
- Maximum file size: 50MB (configurable)
- Processes files in memory

### ✅ File Format Support
- **PDF:** Extracts text using `pdf-parse`
- **Excel:** Converts to CSV text using `xlsx` (supports .xlsx and .xls)

### ✅ Robust JSON Parsing
- Handles markdown code fences
- Fixes trailing commas
- Repairs missing commas
- Handles unquoted keys
- Closes unterminated strings

### ✅ Error Handling
- Comprehensive error messages
- Timeout handling (default: 10 minutes)
- Connection error detection
- Detailed logging

## Testing

### Test the Extraction Server Directly

```bash
curl -X POST http://localhost:8001/extract-invoice \
  -F "file=@path/to/po.pdf" \
  -F "client_name=UNEEK" \
  -F "expected_items=10"
```

### Test via Backend

1. Start extraction server: `cd apps/extraction-server && npm run dev`
2. Start backend: `cd apps/backend && npm run dev`
3. Upload PO via website or API

## Deployment

### Local Development
- Extraction server: `http://localhost:8001`
- Backend: `http://localhost:3000` (or configured port)

### Production
1. Deploy extraction server to a hosting service (Render, Railway, etc.)
2. Set `EXTRACTION_SERVER_URL` in backend environment variables
3. Ensure CORS is configured correctly
4. Set appropriate timeout values

## Monitoring

The extraction server logs:
- File processing start/completion
- File sizes and types
- Extraction duration
- Error details
- OpenAI API calls

Check logs for:
- `[Extraction]` - General extraction process
- `[OpenAI]` - OpenAI API interactions

## Troubleshooting

### Connection Errors
- Verify `EXTRACTION_SERVER_URL` is set correctly
- Check extraction server is running
- Verify CORS configuration

### Timeout Errors
- Increase `EXTRACTION_TIMEOUT_MS` in backend `.env`
- Check file size (large files take longer)
- Monitor extraction server logs

### JSON Parsing Errors
- Check OpenAI response in logs
- Verify prompt is correct
- Review file content extraction

### OpenAI API Errors
- Verify `OPENAI_API_KEY` is set
- Check API key validity
- Monitor API rate limits

## Migration from FastAPI

To migrate from FastAPI to extraction-server:

1. Set `EXTRACTION_SERVER_URL` in backend `.env`
2. Remove or comment out `FASTAPI_URL`
3. Restart backend service
4. Test with a sample PO upload

The backend will automatically use extraction-server instead of FastAPI.
