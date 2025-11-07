import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { getPO, listPOs, PurchaseOrder, upsertPO } from './db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists and set up multer storage
const uploadsDir = path.resolve(__dirname, '..', 'uploads');
fs.ensureDirSync(uploadsDir);
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, uploadsDir),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.pdf';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}-${timestamp}${ext}`);
  },
});
const upload = multer({ storage });

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to ChandraPO API',
    version: '1.0.0',
  });
});

// List POs
app.get('/api/pos', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pos = await listPOs();
    res.json(pos);
  } catch (err) {
    next(err);
  }
});

// Get single PO
app.get('/api/pos/:poNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const poNumber = req.params.poNumber as string;
    const po = await getPO(poNumber);
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json(po);
  } catch (err) {
    next(err);
  }
});

// Upload PO PDF - simulate processing using test response
app.post('/api/pos/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Read the mocked processing output from website test file
    const testJsonPath = path.resolve('/Users/cj/Freelance/ChandraPO/apps/website/test_PO_response.json');
    const testData = await fs.readJson(testJsonPath);
    const first: PurchaseOrder | undefined = Array.isArray(testData) ? testData[0] : undefined;
    if (!first) return res.status(500).json({ error: 'Test response missing' });

    // Attach the stored PDF relative path for future use
    const storedRelative = path.relative(path.resolve(__dirname, '..'), req.file!.path);
    const po: PurchaseOrder = {
      ...first,
      PO: [...(first.PO || []), storedRelative],
    };

    await upsertPO(po);

    res.status(201).json({
      message: 'Uploaded and processed (mock)',
      file: {
        originalName: req.file!.originalname,
        storedAs: storedRelative,
        size: req.file!.size,
      },
      poNumber: po.PONumber,
    });
  } catch (err) {
    next(err);
  }
});

// Update PO
app.put('/api/pos/:poNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const poNumber = req.params.poNumber as string;
    const existingPO = await getPO(poNumber);
    if (!existingPO) return res.status(404).json({ error: 'PO not found' });

    const updatedPO: PurchaseOrder = req.body;
    if (updatedPO.PONumber !== poNumber) {
      return res.status(400).json({ error: 'PO number mismatch' });
    }

    const saved = await upsertPO(updatedPO);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// Serve PO PDF file
app.get('/api/pos/:poNumber/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const poNumber = req.params.poNumber as string;
    const fileParam = req.query.file as string;
    
    if (!fileParam) {
      return res.status(400).json({ error: 'File parameter is required' });
    }

    const po = await getPO(poNumber);
    if (!po) return res.status(404).json({ error: 'PO not found' });

    // Resolve the file path - check if it's in uploads or in the data directory
    let filePath: string;
    if (fileParam.startsWith('uploads/')) {
      filePath = path.resolve(__dirname, '..', fileParam);
    } else {
      // Try uploads directory first
      filePath = path.resolve(__dirname, '..', 'uploads', fileParam);
      if (!fs.existsSync(filePath)) {
        // Try data directory
        filePath = path.resolve(__dirname, '..', 'data', fileParam);
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    // Check if file is actually a PDF for security
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      return res.status(400).json({ error: 'File is not a PDF' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

