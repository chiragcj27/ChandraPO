# Extraction Server

Purchase Order extraction server using OpenAI's GPT-4o-mini model. Extracts structured data from PDF and Excel Purchase Order documents.

## Features

- ✅ PDF text extraction
- ✅ Excel file parsing (XLSX, XLS)
- ✅ OpenAI GPT-4o-mini integration
- ✅ Large file support (up to 50MB)
- ✅ Client-specific field mapping
- ✅ Robust JSON parsing with error recovery
- ✅ TypeScript support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Set your OpenAI API key in `.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=8001
CORS_ORIGIN=*
```

## Development

Run in development mode:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### GET `/health`
Health check endpoint.

### GET `/`
Service status and information.

### POST `/extract-invoice`
Extract Purchase Order data from uploaded file.

**Request:**
- `file` (multipart/form-data): PDF or Excel file
- `client_name` (form field, optional): Client name hint
- `mapping_text` (form field, optional): Client field mapping rules
- `expected_items` (form field, optional): Expected number of items

**Response:**
```json
{
  "total_value": number | null,
  "client_name": string,
  "invoice_number": string,
  "invoice_date": string,
  "total_entries": number,
  "items": [
    {
      "VendorStyleCode": string,
      "Category": string,
      "ItemSize": string | null,
      "OrderQty": number,
      "Metal": string,
      "Tone": string,
      "ItemPoNo": string,
      "ItemRefNo": string,
      "StockType": string | null,
      "MakeType": string | null,
      "CustomerProductionInstruction": string | null,
      "SpecialRemarks": string | null,
      "DesignProductionInstruction": string | null,
      "StampInstruction": string | null
    }
  ]
}
```

## Integration with Backend

The backend service (`apps/backend/src/services/fastapi.service.ts`) can be configured to use this extraction server by setting:

```env
EXTRACTION_SERVER_URL=http://localhost:8001
```

Or continue using FastAPI by setting:
```env
FASTAPI_URL=http://localhost:8000
```

## File Size Limits

- Maximum file size: 50MB
- Supports PDF files up to 30-40MB as specified
- Large files are processed in memory (consider streaming for production at scale)

## Error Handling

The server includes robust JSON parsing with multiple fallback strategies to handle:
- Markdown code fences
- Trailing commas
- Missing commas
- Unquoted keys
- Unterminated strings
