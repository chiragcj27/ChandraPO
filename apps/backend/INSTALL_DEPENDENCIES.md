# Installing Dependencies for PDF Vision Mode

## Overview

PDF vision mode requires system dependencies for the `canvas` package. If you encounter installation errors, follow these steps.

## macOS Installation

### Step 1: Install System Dependencies

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

### Step 2: Install Node.js Packages

```bash
cd apps/backend
npm install
```

## If Installation Still Fails

### Option 1: Use Text Extraction Mode (Default Fallback)

The system will automatically fallback to text extraction if vision mode dependencies aren't available. Set in `.env`:

```env
USE_PDF_IMAGES=false
```

### Option 2: Manual Installation

If `npm install` fails for canvas:

1. **Check if dependencies are installed:**
   ```bash
   pkg-config --modversion cairo
   pkg-config --modversion pango
   ```

2. **If missing, install individually:**
   ```bash
   brew install cairo
   brew install pango
   brew install pkg-config
   ```

3. **Set PKG_CONFIG_PATH if needed:**
   ```bash
   export PKG_CONFIG_PATH="/opt/homebrew/lib/pkgconfig:$PKG_CONFIG_PATH"
   ```

4. **Try installing again:**
   ```bash
   npm install
   ```

## Troubleshooting

### Error: "Package pangocairo was not found"

This means Pango Cairo is missing. Install it:

```bash
brew install pango
```

### Error: "Cannot find module 'pdfjs-dist'"

Run:
```bash
npm install pdfjs-dist
```

### Error: Canvas build fails

1. Make sure all system dependencies are installed
2. Clear npm cache: `npm cache clean --force`
3. Remove node_modules and reinstall: `rm -rf node_modules && npm install`

## Alternative: Use Text Extraction

If you can't install the dependencies, the system will automatically use text extraction mode, which:
- Works without system dependencies
- May miss some items in complex tables
- Is faster but less accurate for tables

To explicitly disable vision mode:

```env
USE_PDF_IMAGES=false
```
