import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { buildPrompt } from './constants/prompt';
import { extractTextFromPDF } from './utils/pdfExtractor';
import { extractTextFromExcel } from './utils/excelExtractor';
import { extractJson, parseJsonWithFallback } from './utils/jsonParser';
import { extractWithOpenAI } from './services/openaiService';
import type { ExtractedPOResponse } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOrigins === '*' ? ['*'] : corsOrigins.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['*'],
    allowedHeaders: ['*'],
    credentials: true,
  })
);

app.use(express.json());

// Configure multer for file uploads
// Increase limits for large PDFs (30-40MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'Extraction Server' });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'Extraction API running 🚀',
    version: '1.0.0',
    extraction_provider: 'openai',
    model: 'gpt-4o-mini',
  });
});

// Main extraction endpoint
app.post('/extract-invoice', upload.single('file'), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ detail: 'No file uploaded' });
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`[Extraction] Starting extraction for file: ${file.originalname} (${fileSizeMB} MB)`);

    // Validate file extension
    const suffix = file.originalname.toLowerCase().match(/\.(pdf|xlsx|xls)$/)?.[0];
    if (!suffix) {
      return res.status(400).json({
        detail: `Unsupported file type. Supported types: .pdf, .xlsx, .xls`,
      });
    }

    // Get form fields
    const clientName = req.body.client_name || null;
    const mappingText = req.body.mapping_text || null;
    const expectedItems = req.body.expected_items
      ? parseInt(req.body.expected_items, 10)
      : null;

    console.log(`[Extraction] Processing ${suffix.toUpperCase()} file: ${file.originalname}`);
    console.log(`[Extraction] Client name: ${clientName || 'not provided'}`);
    console.log(`[Extraction] Expected items: ${expectedItems || 'not provided'}`);

    // Build prompt
    const prompt = buildPrompt(clientName, mappingText, expectedItems);

    let fileContent: string;
    let fileTypeContext: string;

    // Extract content based on file type
    if (suffix === '.pdf') {
      console.log(`[Extraction] Extracting text from PDF...`);
      fileContent = await extractTextFromPDF(file.buffer);
      fileTypeContext =
        '\n\nIMPORTANT: This is a PDF file. Extract text and tables carefully, identifying the client name, PO number, date, and all item rows.';
      console.log(`[Extraction] PDF text extracted (${fileContent.length} chars)`);
    } else {
      // Excel file
      console.log(`[Extraction] Converting Excel file to text format...`);
      fileContent = extractTextFromExcel(file.buffer);
      fileTypeContext =
        '\n\nIMPORTANT: This is an Excel file. The file content is provided below as text. Read all worksheets, identify header rows, and extract all data rows as items. Pay special attention to column names and map them according to the mapping rules provided.';
      console.log(`[Extraction] Excel file converted to text (${fileContent.length} chars)`);
    }

    // Run extraction with OpenAI
    const fullPrompt = prompt + fileTypeContext + '\n\nFile Content:\n' + fileContent;
    const rawResponse = await extractWithOpenAI({
      prompt: fullPrompt,
      fileType: suffix === '.pdf' ? 'pdf' : 'excel',
    });

    console.log(`[Extraction] OpenAI response received (${rawResponse.length} chars)`);

    // Parse JSON from response
    const jsonText = extractJson(rawResponse);
    console.log(`[Extraction] Extracted JSON text (${jsonText.length} chars)`);

    let data: ExtractedPOResponse;
    try {
      data = parseJsonWithFallback(jsonText);
    } catch (parseError) {
      console.error(`[Extraction] JSON parsing failed:`, parseError);
      console.error(`[Extraction] Raw response (first 1000 chars):`, rawResponse.substring(0, 1000));
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate response structure
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Invalid response: items array is missing or invalid');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Extraction] Extraction completed successfully in ${duration}s`);
    console.log(`[Extraction] Extracted ${data.items.length} items`);

    // Return the extracted data
    res.json(data);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Extraction] Extraction failed after ${duration}s:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      detail: `Extraction failed: ${errorMessage}`,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Extraction Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Set' : 'NOT SET'}`);
});
