import type OpenAI from 'openai';
import { toFile } from 'openai/uploads';

/**
 * Upload a PDF buffer to OpenAI Files API (user_data purpose).
 * Files can be up to 512 MB each. Use the returned file_id with the Responses API
 * (input_file + file_id) to send the PDF directly to the model without converting to images.
 *
 * @param openai - OpenAI client instance
 * @param pdfBuffer - PDF file buffer (full document or chunk)
 * @param filename - Filename for the upload (e.g. "po.pdf" or "chunk-1-10.pdf")
 * @returns The file ID to use in responses.create input
 */
export async function uploadPdfToOpenAI(
  openai: OpenAI,
  pdfBuffer: Buffer,
  filename: string
): Promise<string> {
  const file = await openai.files.create({
    file: await toFile(pdfBuffer, filename, { type: 'application/pdf' }),
    purpose: 'user_data',
  });
  return file.id;
}
