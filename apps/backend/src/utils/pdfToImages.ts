// CRITICAL: Set up polyfills BEFORE requiring pdfjs-dist
// These must be set up at module load time, before any require() calls

// Promise.withResolvers polyfill (Node.js 20 compatibility)
if (typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Promise.try polyfill (required by pdfjs-dist v5+)
if (typeof (Promise as any).try === 'undefined') {
  (Promise as any).try = function <T>(fn: () => T | Promise<T>): Promise<T> {
    try {
      const result = fn();
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  };
}

// DOM polyfills (required by pdfjs-dist v4+)
if (typeof globalThis.DOMMatrix === 'undefined') {
  // Simple DOMMatrix polyfill
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(init?: string | number[]) {
      if (init) {
        // Minimal implementation - just enough to satisfy pdfjs-dist
      }
    }
    static fromMatrix(other?: DOMMatrix) {
      return new DOMMatrix();
    }
    multiply(other: DOMMatrix) {
      return new DOMMatrix();
    }
    translate(x: number, y: number) {
      return new DOMMatrix();
    }
    scale(x: number, y?: number) {
      return new DOMMatrix();
    }
  };
}

if (typeof globalThis.DOMPoint === 'undefined') {
  (globalThis as any).DOMPoint = class DOMPoint {
    x = 0;
    y = 0;
    z = 0;
    w = 1;
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  };
}

// Path2D polyfill (required by pdfjs-dist v4+)
// Set up a basic polyfill first, then replace with canvas's native Path2D after canvas loads
if (typeof globalThis.Path2D === 'undefined') {
  // Minimal Path2D polyfill - will be replaced by canvas's native Path2D if available
  (globalThis as any).Path2D = class Path2D {
    private _path: any[] = [];
    
    constructor(path?: Path2D | string) {
      if (path instanceof Path2D) {
        this._path = [...path._path];
      } else if (typeof path === 'string') {
        // SVG path string - minimal support
        this._path = [{ type: 'svg', data: path }];
      }
    }
    
    addPath(path: Path2D, transform?: DOMMatrix) {
      this._path.push({ type: 'addPath', path: path._path, transform });
    }
    
    closePath() {
      this._path.push({ type: 'closePath' });
    }
    
    moveTo(x: number, y: number) {
      this._path.push({ type: 'moveTo', x, y });
    }
    
    lineTo(x: number, y: number) {
      this._path.push({ type: 'lineTo', x, y });
    }
    
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      this._path.push({ type: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y });
    }
    
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      this._path.push({ type: 'quadraticCurveTo', cpx, cpy, x, y });
    }
    
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
      this._path.push({ type: 'arc', x, y, radius, startAngle, endAngle, anticlockwise });
    }
    
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
      this._path.push({ type: 'arcTo', x1, y1, x2, y2, radius });
    }
    
    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
      this._path.push({ type: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise });
    }
    
    rect(x: number, y: number, width: number, height: number) {
      this._path.push({ type: 'rect', x, y, width, height });
    }
  };
  console.log('[PDF] Path2D polyfill initialized');
}

// ImageData polyfill (required by pdfjs-dist v4+)
if (typeof globalThis.ImageData === 'undefined') {
  // Minimal ImageData polyfill - will be replaced by canvas's native ImageData if available
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    
    constructor(data: Uint8ClampedArray | number, width?: number, height?: number) {
      if (data instanceof Uint8ClampedArray) {
        this.data = data;
        this.width = width!;
        this.height = height!;
      } else {
        // If first arg is a number, it's width, second is height
        this.width = data;
        this.height = width!;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
  console.log('[PDF] ImageData polyfill initialized');
}

// Image polyfill (required by pdfjs-dist v4+ for handling images in PDFs)
if (typeof globalThis.Image === 'undefined') {
  // Minimal Image polyfill - will be replaced by canvas's native Image if available
  (globalThis as any).Image = class Image {
    width: number = 0;
    height: number = 0;
    src: string = '';
    onload: ((this: GlobalEventHandlers, ev: Event) => any) | null = null;
    onerror: ((this: GlobalEventHandlers, ev: Event | string) => any) | null = null;
    
    constructor(width?: number, height?: number) {
      if (width !== undefined) this.width = width;
      if (height !== undefined) this.height = height;
    }
  };
  console.log('[PDF] Image polyfill initialized');
}

// Dynamic imports to handle missing dependencies gracefully
let pdfjsLib: any;
let createCanvas: any;
let createImage: any;
let dependenciesAvailable = false;

// Try to load dependencies, but don't fail if they're missing
try {
  // Try @napi-rs/canvas first (preferred by pdfjs-dist v4+)
  let canvasModule: any = null;
  try {
    canvasModule = require('@napi-rs/canvas');
    console.log('[PDF] Using @napi-rs/canvas');
  } catch (napiError) {
    // Fallback to regular canvas
    try {
      canvasModule = require('canvas');
      console.log('[PDF] Using node-canvas (fallback)');
    } catch (canvasError) {
      throw new Error('Neither @napi-rs/canvas nor canvas is available. Please install one: npm install @napi-rs/canvas or npm install canvas');
    }
  }
  
  createCanvas = canvasModule.createCanvas;
  createImage = canvasModule.Image || canvasModule.createImage;
  
  // CRITICAL: Canvas module MUST export Image for pdfjs-dist to work
  if (!canvasModule.Image) {
    throw new Error('Canvas module does not export Image class. This is required for pdfjs-dist.');
  }
  
  // Force set all canvas classes to global scope BEFORE pdfjs-dist loads
  // pdfjs-dist does instanceof checks, so we need the real classes from canvas
  (globalThis as any).Path2D = canvasModule.Path2D || (globalThis as any).Path2D;
  (globalThis as any).ImageData = canvasModule.ImageData || (globalThis as any).ImageData;
  (globalThis as any).Image = canvasModule.Image; // MUST be from canvas, not polyfill
  
  // Verify Image is properly set
  if (typeof globalThis.Image === 'undefined' || globalThis.Image !== canvasModule.Image) {
    throw new Error('Failed to set Image class from canvas module. pdfjs-dist requires the real Image class.');
  }
  
  // Verify what's available
  console.log('[PDF] Canvas module loaded');
  console.log('[PDF] Path2D available:', typeof globalThis.Path2D !== 'undefined');
  console.log('[PDF] ImageData available:', typeof globalThis.ImageData !== 'undefined');
  console.log('[PDF] Image available:', typeof globalThis.Image !== 'undefined');
  console.log('[PDF] Image is canvas Image:', globalThis.Image === canvasModule.Image ? 'YES' : 'NO');
  
  // Now require pdfjs-dist (polyfills are already set up)
  // Try regular build first (legacy may have issues)
  try {
    pdfjsLib = require('pdfjs-dist');
    console.log('[PDF] Using pdfjs-dist regular build');
  } catch (regularError) {
    // Fallback to legacy build if regular doesn't work
    try {
      pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      console.log('[PDF] Using pdfjs-dist legacy build');
    } catch (legacyError) {
      throw new Error('Failed to load pdfjs-dist. Both regular and legacy builds failed.');
    }
  }
  
  if (pdfjsLib && createCanvas && typeof pdfjsLib.getDocument === 'function') {
    dependenciesAvailable = true;
    console.log('[PDF] PDF vision dependencies loaded successfully');
  } else {
    console.warn('[PDF] pdfjs-dist or canvas modules loaded but functions are missing');
    console.warn('[PDF] pdfjsLib:', !!pdfjsLib, 'getDocument:', typeof pdfjsLib?.getDocument);
    console.warn('[PDF] createCanvas:', typeof createCanvas);
  }
} catch (error) {
  console.warn('[PDF] Failed to load PDF vision dependencies:', error instanceof Error ? error.message : String(error));
  console.warn('[PDF] pdfjs-dist or canvas not available. PDF vision mode will be disabled.');
  console.warn('[PDF] To enable PDF vision mode, install: npm install pdfjs-dist canvas');
  console.warn('[PDF] And install system dependencies: brew install pkg-config cairo pango libpng jpeg giflib librsvg');
}

// Set up the worker for pdfjs-dist if available
// For Node.js, we MUST use a local file:// URL (CDN URLs don't work with ESM loader)
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  try {
    const fs = require('fs');
    const path = require('path');
    const { pathToFileURL } = require('url');
    
    // Try to find worker file - check multiple possible locations
    // Note: In monorepo, node_modules is at root level, not in apps/backend
    let workerPath: string | null = null;
    
    // Get project root (go up 4 levels from src/utils to project root)
    // __dirname = apps/backend/src/utils -> go up 4 levels = project root
    // ../ = src, ../../ = backend, ../../../ = apps, ../../../../ = root
    const projectRoot = path.resolve(__dirname, '../../../../');
    const backendCwd = process.cwd();
    
    console.log('[PDF] Searching for worker file. Project root:', projectRoot);
    console.log('[PDF] Backend cwd:', backendCwd);
    
    const possiblePaths = [
      // Check from project root (monorepo structure)
      path.join(projectRoot, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
      path.join(projectRoot, 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
      path.join(projectRoot, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
      path.join(projectRoot, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
      // Check from backend directory (if installed locally)
      path.join(backendCwd, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
      path.join(backendCwd, 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
      path.join(backendCwd, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
      path.join(backendCwd, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
      // Check relative to current file
      path.join(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
      path.join(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs'),
      path.join(__dirname, '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
      path.join(__dirname, '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
      // Fallback to .js extensions
      path.join(projectRoot, 'node_modules/pdfjs-dist/build/pdf.worker.js'),
      path.join(backendCwd, 'node_modules/pdfjs-dist/build/pdf.worker.js'),
    ];
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        workerPath = testPath;
        break;
      }
    }
    
    if (workerPath) {
      // Convert to file:// URL with localhost host (required on macOS)
      // Use absolute path to avoid issues
      const absolutePath = path.resolve(workerPath);
      const fileUrl = pathToFileURL(absolutePath).href.replace('file://', 'file://localhost');
      pdfjsLib.GlobalWorkerOptions.workerSrc = fileUrl;
      console.log('[PDF] Using local PDF.js worker:', absolutePath);
    } else {
      // If no worker found, try to use a data URL or disable worker
      // For Node.js, we can try to disable worker by using null (some versions support this)
      try {
        // Try setting to null first
        pdfjsLib.GlobalWorkerOptions.workerSrc = null as any;
        console.log('[PDF] Worker disabled (no local worker file found)');
      } catch {
        // If null doesn't work, we need to find the worker file
        throw new Error(
          'PDF.js worker file not found. Please ensure pdfjs-dist is installed correctly. ' +
          'Searched paths: ' + possiblePaths.join(', ')
        );
      }
    }
  } catch (error) {
    console.error('[PDF] Failed to set up worker:', error instanceof Error ? error.message : String(error));
    // Try to continue without worker (may work for some operations)
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = null as any;
      console.log('[PDF] Worker disabled due to error');
    } catch {
      throw new Error(`Failed to configure PDF.js worker: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export interface PDFImage {
  pageNumber: number;
  base64: string;
}

/**
 * Converts PDF pages to base64-encoded images
 * This preserves tables, formatting, and visual layout that text extraction might miss
 */
export async function convertPDFToImages(buffer: Buffer): Promise<PDFImage[]> {
  if (!dependenciesAvailable || !pdfjsLib || !createCanvas) {
    const errorMsg = dependenciesAvailable 
      ? 'PDF vision dependencies are loaded but functions are not available'
      : 'PDF vision mode requires pdfjs-dist and canvas packages. ' +
          'Install with: npm install pdfjs-dist canvas ' +
          'And system dependencies: brew install pkg-config cairo pango libpng jpeg giflib librsvg';
    throw new Error(errorMsg);
  }

  try {
    // Convert Buffer to Uint8Array (required by pdfjs-dist v5+)
    const uint8Array = new Uint8Array(buffer);
    
    // Configure pdfjs-dist to use Node.js environment
    // This helps with image handling in Node.js
    const loadingTask = pdfjsLib.getDocument({ 
      data: uint8Array,
      // Disable worker to avoid issues in Node.js
      useWorkerFetch: false,
      isEvalSupported: false,
      // Use system fonts
      standardFontDataUrl: undefined,
    });
    
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    console.log(`[PDF] Converting ${numPages} pages to images...`);

    const images: PDFImage[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Set scale for high quality (2x for better OCR/vision model accuracy)
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Verify Image is available before rendering
      if (typeof globalThis.Image === 'undefined') {
        throw new Error('Image class is not available. Canvas module may not be loaded correctly.');
      }
      
      // Test that Image can be instantiated (pdfjs-dist does instanceof checks)
      try {
        const testImage = new (globalThis as any).Image();
        console.log(`[PDF] Image class test passed for page ${pageNum}`);
      } catch (imgError) {
        console.warn(`[PDF] Image class test failed for page ${pageNum}:`, imgError);
      }

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      try {
        await page.render(renderContext).promise;
      } catch (renderError) {
        // Provide more context about the error
        const errorMsg = renderError instanceof Error ? renderError.message : String(renderError);
        console.error(`[PDF] Render error on page ${pageNum}:`, errorMsg);
        console.error(`[PDF] Image available:`, typeof globalThis.Image !== 'undefined');
        console.error(`[PDF] Image type:`, typeof globalThis.Image);
        throw renderError;
      }

      // Convert canvas to base64 image
      const base64 = canvas.toDataURL('image/png').split(',')[1]; // Remove data:image/png;base64, prefix

      images.push({
        pageNumber: pageNum,
        base64: base64,
      });

      console.log(`[PDF] Converted page ${pageNum}/${numPages} to image`);
    }

    console.log(`[PDF] Successfully converted ${numPages} pages to images`);
    return images;
  } catch (error) {
    throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
