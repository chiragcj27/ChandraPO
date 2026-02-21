import OpenAI from 'openai';
import dotenv from 'dotenv';
import type { ExtractedPOResponse } from '../types/po';
import { extractTextFromExcel } from '../utils/excelExtractor';
import { extractJson, parseJsonWithFallback } from '../utils/jsonParser';
import { buildPrompt } from '../constants/extractionPrompt';
import { extractPDFChunks, type PDFPageRange } from '../utils/pdfChunks';
import { uploadPdfToOpenAI } from '../utils/uploadPdfToOpenAI';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Optional: set EXTRACTION_MODEL=gpt-4o for better table/item accuracy (default gpt-5.2)
const EXTRACTION_MODEL = (process.env.EXTRACTION_MODEL || 'gpt-5.2').trim();
// Max output tokens — use 128k so large POs don't get truncated (GPT-5.2 supports 128k; older models may need lower)
const MAX_OUTPUT_TOKENS = 128000;

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
    options?: { 
      clientName?: string; 
      mappingText?: string; 
      expectedItems?: number;
      pageRanges?: PDFPageRange[]; // Page ranges for chunked extraction
    },
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

      // Handle PDF files — upload PDF to OpenAI Files API and use Responses API with file_id (no image conversion)
      if (suffix === '.pdf') {
        // If page ranges are provided, use chunked extraction (each chunk = one PDF file upload)
        if (options?.pageRanges && options.pageRanges.length > 0) {
          console.log(`[Extraction] Using chunked PDF extraction with ${options.pageRanges.length} page range(s)`);
          const pdfChunks = await extractPDFChunks(file.buffer, options.pageRanges);
          console.log(`[Extraction] Created ${pdfChunks.length} PDF chunk(s)`);

          const allItems: any[] = [];
          let clientName: string | undefined;
          let invoiceNumber: string | undefined;
          let invoiceDate: string | undefined;
          let totalValue = 0;
          const uploadedFileIds: string[] = [];

          try {
            for (let i = 0; i < pdfChunks.length; i++) {
              const chunk = pdfChunks[i];
              const range = chunk.pages;
              const expectedItemsForChunk = range.expectedItems;

              console.log(`[Extraction] Uploading chunk ${i + 1}/${pdfChunks.length} (pages ${range.startPage}-${range.endPage})...`);
              const chunkFilename = `chunk-${range.startPage}-${range.endPage}.pdf`;
              const fileId = await uploadPdfToOpenAI(openai, chunk.buffer, chunkFilename);
              uploadedFileIds.push(fileId);
              console.log(`[Extraction] Chunk ${i + 1} uploaded, file_id: ${fileId}`);

              const chunkPrompt = buildPrompt(
                options?.clientName,
                options?.mappingText,
                expectedItemsForChunk
              );

              const totalExpected = options?.expectedItems;
              const countConstraint =
                expectedItemsForChunk != null
                  ? ` This chunk MUST contain exactly ${expectedItemsForChunk} items — no more, no less. Output exactly ${expectedItemsForChunk} entries in "items".`
                  : totalExpected != null
                    ? ` The full document has exactly ${totalExpected} items total across all chunks. Extract only the item rows that appear on THESE pages (${range.startPage}-${range.endPage}); count serial numbers on these pages and output exactly that many items. Do not include header rows, subtotal rows, or blank rows as items.`
                    : ` Extract only data rows (serial-numbered item rows); do not include header rows, subtotal rows, or blank rows as items.`;

              const chunkInstructions =
                `\n\nIMPORTANT — PDF extraction (Pages ${range.startPage}-${range.endPage}): ` +
                `This is a PDF file containing pages ${range.startPage} to ${range.endPage} of the original document. ` +
                `(1) Identify the client name, PO number, and date from the header (if present on these pages). ` +
                `(2) Locate the item table on these pages and identify the column headers. ` +
                `(3) For EVERY data row (each serial-numbered line), read each cell under the correct column and map to our schema using the client mapping. ` +
                `Extract every item row from these pages only; do not skip rows and do not add extra rows.` +
                countConstraint +
                ` For each item, use ONLY that row's cell values — do not copy or carry over values from other rows. ` +
                `ItemPoNo is the same for all items (from header); all other fields must come from the specific row only.`;

              const chunkResponse = await openai.responses.create({
                model: EXTRACTION_MODEL,
                input: [
                  {
                    role: 'user',
                    content: [
                      { type: 'input_file', file_id: fileId },
                      { type: 'input_text', text: chunkPrompt + chunkInstructions },
                    ],
                  },
                ],
                temperature: 0.1,
                max_output_tokens: MAX_OUTPUT_TOKENS,
                text: { format: { type: 'json_object' } },
              });

              const chunkRawResponse = chunkResponse.output_text?.trim() || '';
              console.log(`[Extraction] Chunk ${i + 1} response received (${chunkRawResponse.length} chars)`);

              const chunkJsonText = extractJson(chunkRawResponse);
              const expectedForChunk = expectedItemsForChunk;
              let chunkData: ExtractedPOResponse;
              try {
                chunkData = parseJsonWithFallback(chunkJsonText, {
                  onTruncationRepaired: (recoveredCount) => {
                    if (expectedForChunk != null && recoveredCount < expectedForChunk) {
                      throw new Error(
                        `Chunk ${i + 1} response was truncated. Recovered ${recoveredCount} items but expected ${expectedForChunk}. Use smaller page ranges or higher token limit.`
                      );
                    }
                  },
                });
              } catch (parseError) {
                console.error(`[Extraction] JSON parsing failed for chunk ${i + 1}:`, parseError);
                throw new Error(`Failed to parse JSON response for chunk ${i + 1}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
              }

              if (!chunkData.items || !Array.isArray(chunkData.items)) {
                throw new Error(`Invalid response for chunk ${i + 1}: items array is missing or invalid`);
              }

              if (!clientName && chunkData.client_name) clientName = chunkData.client_name;
              if (!invoiceNumber && chunkData.invoice_number) invoiceNumber = chunkData.invoice_number;
              if (!invoiceDate && chunkData.invoice_date) invoiceDate = chunkData.invoice_date;
              totalValue += Number(chunkData.total_value) || 0;
              allItems.push(...chunkData.items);
              console.log(`[Extraction] Chunk ${i + 1} extracted ${chunkData.items.length} items`);
            }

            const combinedResponse: ExtractedPOResponse = {
              client_name: clientName || options?.clientName || 'Unknown Client',
              invoice_number: invoiceNumber || '',
              invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
              total_value: totalValue,
              total_entries: allItems.length,
              items: allItems,
            };

            if (options?.expectedItems != null && allItems.length !== options.expectedItems) {
              console.warn(
                `[Extraction] Expected ${options.expectedItems} items but combined extraction has ${allItems.length} items.`
              );
            }
            console.log(`[Extraction] Combined extraction: ${allItems.length} total items from ${pdfChunks.length} chunk(s)`);
            return combinedResponse;
          } finally {
            for (const fid of uploadedFileIds) {
              try {
                await openai.files.del(fid);
              } catch (e) {
                console.warn(`[Extraction] Could not delete uploaded file ${fid}:`, e);
              }
            }
          }
        }

        // Single PDF (no chunking): upload full file and send to Responses API
        console.log(`[Extraction] Uploading PDF to OpenAI Files API...`);
        const fileId = await uploadPdfToOpenAI(openai, file.buffer, file.originalname || 'document.pdf');
        console.log(`[Extraction] PDF uploaded, file_id: ${fileId}`);

        const pdfInstructions =
          '\n\nIMPORTANT — PDF extraction: This is a PDF file. (1) Identify the client name, PO number, and date from the header. (2) Locate the item table on each page and identify the column headers. (3) For EVERY data row (each serial-numbered line), read each cell under the correct column and map to our schema using the client mapping. Extract EVERY item row across all pages; do not skip rows. For each item, use ONLY that row\'s cell values — do not copy or carry over values from other rows. ItemPoNo is the same for all items (from header); all other fields must come from the specific row only.';

        try {
          const response = await openai.responses.create({
            model: EXTRACTION_MODEL,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_file', file_id: fileId },
                  { type: 'input_text', text: prompt + pdfInstructions },
                ],
              },
            ],
            temperature: 0.1,
            max_output_tokens: MAX_OUTPUT_TOKENS,
            text: { format: { type: 'json_object' } },
          });

          const rawResponse = response.output_text?.trim() || '';
          console.log(`[Extraction] OpenAI response received (${rawResponse.length} chars)`);

          const jsonText = extractJson(rawResponse);
          console.log(`[Extraction] Extracted JSON text (${jsonText.length} chars)`);

          const expectedItems = options?.expectedItems;
          let data: ExtractedPOResponse;
          try {
            data = parseJsonWithFallback(jsonText, {
              onTruncationRepaired: (recoveredCount) => {
                if (expectedItems != null && recoveredCount < expectedItems) {
                  throw new Error(
                    `Response was truncated by the model (output token limit). Recovered only ${recoveredCount} items but expected ${expectedItems}. ` +
                      `Extraction now uses a higher token limit; if you still see this, use chunked PDF extraction for very large POs.`
                  );
                }
              },
            });
          } catch (parseError) {
            console.error(`[Extraction] JSON parsing failed:`, parseError);
            console.error(`[Extraction] Raw response (first 1000 chars):`, rawResponse.substring(0, 1000));
            throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }

          if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid response: items array is missing or invalid');
          }

          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`[Extraction] Extraction completed successfully in ${duration}s`);
          console.log(`[Extraction] Extracted ${data.items.length} items`);

          if (options?.expectedItems && data.items.length !== options.expectedItems) {
            console.warn(
              `[Extraction] WARNING: Expected ${options.expectedItems} items but extracted ${data.items.length} items. ` +
                `The PDF might have items on multiple pages or in tables that weren't fully captured.`
            );
          }

          return data;
        } finally {
          try {
            await openai.files.del(fileId);
          } catch (e) {
            console.warn(`[Extraction] Could not delete uploaded file ${fileId}:`, e);
          }
        }
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
      // Use high max_completion_tokens so the full items array is returned (avoids truncation for large POs).
      const response = await openai.chat.completions.create({
        model: EXTRACTION_MODEL,
        messages: messages as any,
        temperature: 0.1,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      });

      const rawResponse = response.choices[0]?.message?.content?.trim() || '';
      console.log(`[Extraction] OpenAI response received (${rawResponse.length} chars)`);

      // Parse JSON from response
      const jsonText = extractJson(rawResponse);
      console.log(`[Extraction] Extracted JSON text (${jsonText.length} chars)`);

      const expectedItems = options?.expectedItems;
      let data: ExtractedPOResponse;
      try {
        data = parseJsonWithFallback(jsonText, {
          onTruncationRepaired: (recoveredCount) => {
            if (expectedItems != null && recoveredCount < expectedItems) {
              throw new Error(
                `Response was truncated by the model (output token limit). Recovered only ${recoveredCount} items but expected ${expectedItems}. ` +
                  `Extraction now uses a higher token limit; if you still see this, the PO may be too large for a single request.`
              );
            }
          },
        });
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
