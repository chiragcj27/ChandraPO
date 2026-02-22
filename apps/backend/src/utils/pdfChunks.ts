import { PDFDocument } from 'pdf-lib';

export interface PDFPageRange {
  startPage: number; // 1-indexed
  endPage: number; // 1-indexed (inclusive)
  expectedItems?: number; // Optional expected item count for this range
}

export interface PDFChunk {
  pages: PDFPageRange;
  buffer: Buffer; // PDF buffer containing only the specified pages
  base64: string; // Base64-encoded PDF
}

/**
 * Extract specific page ranges from a PDF and create PDF chunks
 * @param pdfBuffer Original PDF buffer
 * @param pageRanges Array of page ranges to extract (1-indexed)
 * @returns Array of PDF chunks
 */
export async function extractPDFChunks(
  pdfBuffer: Buffer,
  pageRanges: PDFPageRange[]
): Promise<PDFChunk[]> {
  try {
    // Load the original PDF using pdf-lib
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const totalPages = sourcePdf.getPageCount();

    // Validate page ranges
    for (const range of pageRanges) {
      if (range.startPage < 1 || range.endPage > totalPages || range.startPage > range.endPage) {
        throw new Error(
          `Invalid page range: ${range.startPage}-${range.endPage}. PDF has ${totalPages} pages.`
        );
      }
    }

    const chunks: PDFChunk[] = [];

    // Create a PDF chunk for each page range
    for (const range of pageRanges) {
      // Create a new PDF document for this chunk
      const chunkPdf = await PDFDocument.create();

      // Copy pages from the source PDF to the chunk PDF
      const pagesToCopy = [];
      for (let i = range.startPage - 1; i < range.endPage; i++) {
        pagesToCopy.push(i);
      }

      const copiedPages = await chunkPdf.copyPages(sourcePdf, pagesToCopy);
      copiedPages.forEach((page) => chunkPdf.addPage(page));

      // Serialize the chunk PDF to bytes
      const pdfBytes = await chunkPdf.save();
      const chunkBuffer = Buffer.from(pdfBytes);
      const base64 = chunkBuffer.toString('base64');

      chunks.push({
        pages: range,
        buffer: chunkBuffer,
        base64,
      });
    }

    return chunks;
  } catch (error) {
    console.error('[PDF Chunks] Error extracting PDF chunks:', error);
    throw new Error(
      `Failed to extract PDF chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get total number of pages in a PDF
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const pdf = await PDFDocument.load(pdfBuffer);
    return pdf.getPageCount();
  } catch (error) {
    throw new Error(
      `Failed to get PDF page count: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
