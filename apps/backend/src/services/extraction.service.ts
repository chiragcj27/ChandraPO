import OpenAI from 'openai';
import dotenv from 'dotenv';
import type { ExtractedPOResponse } from '../types/po';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import { extractTextFromExcel } from '../utils/excelExtractor';
import { convertPDFToImages } from '../utils/pdfToImages';
import { extractJson, parseJsonWithFallback } from '../utils/jsonParser';
import { buildPrompt } from '../constants/extractionPrompt';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_PDF_IMAGES = process.env.USE_PDF_IMAGES !== 'true'; // Default to true
// Optional: set EXTRACTION_MODEL=gpt-4o for better table/item accuracy (default gpt-4o-mini)
const EXTRACTION_MODEL = (process.env.EXTRACTION_MODEL || 'gpt-4o').trim();

if (!OPENAI_API_KEY) {
  console.warn('[Extraction] WARNING: OPENAI_API_KEY not set. Extraction will fail.');
}

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
    })
  : null;

export const extractionService = {
  async extractPurchaseOrder(
    file: Express.Multer.File,
    options?: { clientName?: string; mappingText?: string; expectedItems?: number },
  ): Promise<ExtractedPOResponse> {
    const startTime = Date.now();

    if (!openai) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
    }

    try {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[Extraction] Starting extraction for file: ${file.originalname} (${fileSizeMB} MB)`);

      // Validate file extension
      const suffix = file.originalname.toLowerCase().match(/\.(pdf|xlsx|xls)$/)?.[0];
      if (!suffix) {
        throw new Error(`Unsupported file type. Supported types: .pdf, .xlsx, .xls`);
      }

      console.log(`[Extraction] Processing ${suffix.toUpperCase()} file: ${file.originalname}`);
      console.log(`[Extraction] Client name: ${options?.clientName || 'not provided'}`);
      console.log(`[Extraction] Expected items: ${options?.expectedItems || 'not provided'}`);

      // Build prompt
      const prompt = buildPrompt(options?.clientName, options?.mappingText, options?.expectedItems);

      let messages: Array<{ role: 'user'; content: any }>;

      // Handle PDF files - use vision API with images ONLY (no text fallback)
      if (suffix === '.pdf') {
        if (!USE_PDF_IMAGES) {
          throw new Error(
            'PDF vision mode is disabled. Text extraction is not reliable for tables. ' +
            'Please enable vision mode by setting USE_PDF_IMAGES=true or removing it from .env'
          );
        }

        console.log(`[Extraction] Converting PDF pages to images for vision model...`);
        const pdfImages = await convertPDFToImages(file.buffer);
        console.log(`[Extraction] Converted ${pdfImages.length} pages to images`);

        // Build message with images for vision model
        const pdfInstructions =
          '\n\nIMPORTANT — PDF extraction: This is a PDF file. (1) Identify the client name, PO number, and date from the header. (2) Locate the item table on each page and identify the column headers. (3) For EVERY data row (each serial-numbered line), read each cell under the correct column and map to our schema using the client mapping. Extract EVERY item row across all pages; do not skip rows. For each item, use ONLY that row\'s cell values — do not copy or carry over values from other rows. ItemPoNo is the same for all items (from header); all other fields must come from the specific row only.';
        const content: any[] = [
          {
            type: 'text',
            text: prompt + pdfInstructions,
          },
        ];

        // Add all PDF pages as images
        for (const image of pdfImages) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${image.base64}`,
            },
          });
        }

        messages = [
          {
            role: 'user',
            content: content,
          },
        ];
      } else {
        // Excel file - use text extraction
        console.log(`[Extraction] Converting Excel file to text format...`);
        const fileContent = extractTextFromExcel(file.buffer);
        const fileTypeContext =
          '\n\nIMPORTANT: This is an Excel file. The file content is provided below as text. Read all worksheets, identify header rows, and extract all data rows as items. Pay special attention to column names and map them according to the mapping rules provided.';
        console.log(`[Extraction] Excel file converted to text (${fileContent.length} chars)`);

        messages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt + fileTypeContext + '\n\nFile Content:\n' + fileContent,
              },
            ],
          },
        ];
      }

      // Run extraction with OpenAI
      console.log(`[Extraction] Calling OpenAI API...`);
      // Use high max_tokens so the full items array is returned (avoids truncation for large POs).
      // gpt-4o-mini supports up to 16,384 output tokens; ~12k tokens ≈ 91 items, so 16k covers 100+ items.
      const response = await openai.chat.completions.create({
        model: EXTRACTION_MODEL,
        messages: messages as any,
        temperature: 0.1,
        max_tokens: 16384,
        response_format: { type: 'json_object' },
      });

      const rawResponse = response.choices[0]?.message?.content?.trim() || '';
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

      // Warn if expected items don't match
      if (options?.expectedItems && data.items.length !== options.expectedItems) {
        console.warn(
          `[Extraction] WARNING: Expected ${options.expectedItems} items but extracted ${data.items.length} items. ` +
            `The PDF might have items on multiple pages or in tables that weren't fully captured.`
        );
      }

      return data;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`[Extraction] Extraction failed after ${duration}s:`, error);

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Extraction failed: ${String(error)}`);
    }
  },
};
