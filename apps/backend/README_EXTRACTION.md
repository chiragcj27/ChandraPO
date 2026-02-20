# PO Extraction Integration

The Purchase Order extraction functionality is now integrated directly into the backend server, using OpenAI's GPT-4o-mini model.

## Setup

1. **Install dependencies:**
   ```bash
   cd apps/backend
   npm install
   ```

2. **Set OpenAI API key in `.env`:**
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## How It Works

1. **File Upload:** When a PO (PDF or Excel) is uploaded via the website, it's sent to the backend
2. **Client Mapping:** Backend fetches the client's field mapping from the database
3. **Text Extraction:** 
   - PDF files: Text is extracted using `pdf-parse`
   - Excel files: Converted to CSV text using `xlsx`
4. **OpenAI Extraction:** The extracted text and client mapping are sent to OpenAI GPT-4o-mini
5. **JSON Parsing:** Response is parsed with robust error handling
6. **Data Storage:** Extracted data is stored in the database

## Architecture

```
Website (Frontend)
    ↓
Backend (Express) ← OpenAI API
    ↓
Database (MongoDB)
```

## Features

- ✅ Direct OpenAI integration (no separate service needed)
- ✅ PDF text extraction
- ✅ Excel file parsing (XLSX, XLS)
- ✅ Large file support (handles 30-40MB PDFs)
- ✅ Client-specific field mapping
- ✅ Robust JSON parsing with error recovery
- ✅ Comprehensive error handling

## File Structure

- `src/services/extraction.service.ts` - Main extraction service
- `src/utils/pdfExtractor.ts` - PDF text extraction
- `src/utils/excelExtractor.ts` - Excel to CSV conversion
- `src/utils/jsonParser.ts` - JSON parsing utilities
- `src/constants/extractionPrompt.ts` - OpenAI prompt template

## Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here  # Required
```

## Error Handling

The extraction service includes:
- File type validation
- OpenAI API error handling
- JSON parsing with multiple fallback strategies
- Detailed logging for debugging

## Migration Notes

The extraction logic was previously in a separate FastAPI service. It's now integrated into the backend for:
- Simpler architecture
- Fewer services to manage
- No network overhead
- Easier deployment

The old `fastapi.service.ts` can be removed if no longer needed, but `extraction.service.ts` replaces its functionality.
