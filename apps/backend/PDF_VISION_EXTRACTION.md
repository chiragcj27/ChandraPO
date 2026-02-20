# PDF Vision-Based Extraction

## Overview

The extraction service now uses OpenAI's vision capabilities to process PDFs directly as images, preserving tables, formatting, and visual layout that text extraction might miss.

## How It Works

1. **PDF to Images**: PDF pages are converted to PNG images using `pdfjs-dist` and `canvas`
2. **Vision API**: Images are sent to OpenAI's `gpt-4o-mini` vision model
3. **Better Accuracy**: Vision model can see tables, formatting, and multi-page layouts that text extraction misses

## Benefits

- ✅ **Better Table Extraction**: Vision models excel at reading tables
- ✅ **Multi-page Support**: Can see items across multiple pages
- ✅ **Format Preservation**: Maintains visual structure and layout
- ✅ **Higher Accuracy**: Should extract all 103 items instead of missing some

## Setup

### 1. Install Dependencies

```bash
cd apps/backend
npm install
```

**Note**: The `canvas` package requires system dependencies:
- **macOS**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
- **Ubuntu/Debian**: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
- **Windows**: See [node-canvas installation guide](https://github.com/Automattic/node-canvas#compiling)

### 2. Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Set to 'false' to use text extraction instead of images
USE_PDF_IMAGES=true  # Default: true
```

## Usage

The extraction service automatically uses vision mode for PDFs when `USE_PDF_IMAGES=true` (default).

### Vision Mode (Default)
- Converts PDF pages to images
- Sends images to OpenAI vision API
- Better accuracy for tables and complex layouts

### Text Mode (Fallback)
- Set `USE_PDF_IMAGES=false` to use text extraction
- Faster but may miss items in tables

## Troubleshooting

### Canvas Installation Issues

If you get errors about canvas dependencies:

**macOS:**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### PDF.js Worker Issues

If you see worker errors, the code will automatically fallback to CDN. You can also bundle the worker locally by ensuring `pdfjs-dist/build/pdf.worker.min.mjs` exists in node_modules.

### Large PDFs

For very large PDFs (many pages), consider:
- Processing pages in batches
- Using a higher scale factor for better quality (currently 2.0)
- Monitoring memory usage

## Performance

- **Image Conversion**: ~1-2 seconds per page
- **OpenAI API**: Depends on number of pages and image size
- **Total**: Typically 30-60 seconds for a multi-page PDF

## Expected Results

With vision mode, you should see:
- All items extracted (e.g., 103 items instead of 37)
- Better table recognition
- Accurate multi-page extraction
- Proper handling of complex layouts

## Fallback

If vision mode fails or canvas isn't available, the service will automatically fallback to text extraction mode.
