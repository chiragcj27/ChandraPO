# Quick Start - PDF Extraction

## Current Status

The extraction service is now set up to work **without requiring system dependencies**. It will automatically use text extraction mode if PDF vision dependencies aren't available.

## Option 1: Use Text Extraction (Works Now)

The system is ready to use with text extraction:

```bash
cd apps/backend
npm install  # This should work now (canvas/pdfjs-dist removed)
npm run dev
```

Set in `.env`:
```env
OPENAI_API_KEY=your_key_here
USE_PDF_IMAGES=false  # Use text extraction
```

**Note**: Text extraction may miss some items in complex tables (like your 103 items → 37 items issue).

## Option 2: Enable PDF Vision Mode (Better Accuracy)

To get better accuracy and extract all items:

### Step 1: Install System Dependencies

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

### Step 2: Install Vision Dependencies

```bash
cd apps/backend
npm install canvas pdfjs-dist
```

### Step 3: Enable Vision Mode

In `.env`:
```env
OPENAI_API_KEY=your_key_here
USE_PDF_IMAGES=true  # Use vision mode (default)
```

### Optional: Use a stronger model for item accuracy

If item details (style code, qty, metal, tone, etc.) are still wrong, try the more capable vision model:

```env
EXTRACTION_MODEL=gpt-4o
```

Default is `gpt-4o-mini`. `gpt-4o` costs more but often gives more accurate per-row extraction from tables.

## Testing

1. **Start the backend:**
   ```bash
   npm run dev
   ```

2. **Upload a PO** via the website

3. **Check logs** - you'll see:
   - `[Extraction] Converting PDF pages to images...` (vision mode)
   - OR `[Extraction] Extracting text from PDF...` (text mode)

## Troubleshooting

### If npm install fails for canvas:

The code will automatically fallback to text extraction. You'll see a warning:
```
[PDF] pdfjs-dist or canvas not available. PDF vision mode will be disabled.
```

### If you want to force text mode:

Set in `.env`:
```env
USE_PDF_IMAGES=false
```

## Expected Results

- **Text Mode**: May extract 37/103 items (misses table rows)
- **Vision Mode**: Should extract all 103 items (sees tables visually)
