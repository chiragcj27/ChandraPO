import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import type { ExtractedPOResponse } from '../types/po';

dotenv.config();

const FASTAPI_BASE_URL = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/$/, '');

export const fastapiService = {
  async extractPurchaseOrder(
    file: Express.Multer.File,
    options?: { clientName?: string; mappingText?: string; expectedItems?: number },
  ): Promise<ExtractedPOResponse> {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      knownLength: file.size,
    });

    if (options?.clientName) {
      formData.append('client_name', options.clientName);
    }
    if (options?.mappingText) {
      formData.append('mapping_text', options.mappingText);
    }
    if (typeof options?.expectedItems === 'number' && Number.isInteger(options.expectedItems) && options.expectedItems > 0) {
      formData.append('expected_items', String(options.expectedItems));
    }

    const timeout = Number(process.env.FASTAPI_TIMEOUT_MS || 600000); // Default 10 minutes (600000ms) - OpenAI can take 5+ minutes for large PDFs
    const startTime = Date.now();
    const fileSizeKB = (file.size / 1024).toFixed(2);

    try {
      console.log(`[Backend][extract] step=1_forward file=${file.originalname} | Forwarding to FastAPI: ${fileSizeKB} KB, clientName=${Boolean(options?.clientName)}, mappingLen=${options?.mappingText?.length ?? 0}, expectedItems=${options?.expectedItems ?? 'none'}`);
      console.log(`[Backend][extract] step=1_forward file=${file.originalname} | FastAPI URL: ${FASTAPI_BASE_URL}, timeout: ${(timeout / 1000).toFixed(0)}s`);

      const { data } = await axios.post<ExtractedPOResponse>(
        `${FASTAPI_BASE_URL}/extract-invoice`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const itemCount = Array.isArray(data?.items) ? data.items.length : 0;
      console.log(`[Backend][extract] step=2_response file=${file.originalname} | FastAPI extraction done in ${duration}s, items=${itemCount}`);

      return data;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`[Backend] Failed to extract PO from FastAPI after ${duration}s`);
      console.error(`[Backend] FastAPI URL: ${FASTAPI_BASE_URL}`);
      
      if (axios.isAxiosError(error)) {
        console.error(`[Backend] Axios error details:`, {
          code: error.code,
          message: error.message,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 500) 
              : error.response.data,
          } : undefined,
        });
        
        if (error.code === 'ECONNABORTED') {
          throw new Error(`FastAPI request timed out after ${timeout}ms (${(timeout / 1000).toFixed(0)}s). The PDF processing may be taking longer than expected. Consider increasing FASTAPI_TIMEOUT_MS environment variable.`);
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to FastAPI server at ${FASTAPI_BASE_URL}. Make sure the FastAPI server is running and the FASTAPI_URL environment variable is set correctly.`);
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
          throw new Error(`Connection to FastAPI server at ${FASTAPI_BASE_URL} timed out or was reset. This may indicate the server is overloaded or unreachable.`);
        }
        if (error.response) {
          const status = error.response.status;
          const statusText = error.response.statusText;
          const errorDetail = typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 200)
            : JSON.stringify(error.response.data).substring(0, 200);
          
          if (status === 502) {
            throw new Error(`FastAPI returned 502 Bad Gateway. This usually means: 1) FastAPI service is down or not responding, 2) Request timeout (Render has 60s timeout), 3) FastAPI service URL is incorrect. Check Render logs for FastAPI service.`);
          }
          throw new Error(`FastAPI returned error ${status}: ${statusText}. ${errorDetail ? `Details: ${errorDetail}` : ''}`);
        }
        if (error.request) {
          throw new Error(`No response from FastAPI server at ${FASTAPI_BASE_URL}. The server may be down or unreachable. Error: ${error.message}`);
        }
      }
      
      console.error(`[Backend] Unexpected error:`, error);
      throw new Error(`Failed to extract data from FastAPI: ${(error as Error).message}`);
    }
  },

  /**
   * Extract purchase order from S3 URL instead of file buffer.
   * This avoids Render timeout by having FastAPI download directly from S3.
   */
  async extractPurchaseOrderFromS3(
    s3Url: string,
    filename: string,
    options?: { clientName?: string; mappingText?: string; expectedItems?: number },
  ): Promise<ExtractedPOResponse> {
    const formData = new FormData();
    formData.append('s3_url', s3Url);
    formData.append('filename', filename);

    if (options?.clientName) {
      formData.append('client_name', options.clientName);
    }
    if (options?.mappingText) {
      formData.append('mapping_text', options.mappingText);
    }
    if (typeof options?.expectedItems === 'number' && Number.isInteger(options.expectedItems) && options.expectedItems > 0) {
      formData.append('expected_items', String(options.expectedItems));
    }

    const timeout = Number(process.env.FASTAPI_TIMEOUT_MS || 600000); // Default 10 minutes (600000ms) - OpenAI can take 5+ minutes for large PDFs
    const startTime = Date.now();

    try {
      console.log(`[Backend][extract-s3] step=1_forward file=${filename} | Forwarding S3 URL to FastAPI, clientName=${Boolean(options?.clientName)}, mappingLen=${options?.mappingText?.length ?? 0}, expectedItems=${options?.expectedItems ?? 'none'}`);
      console.log(`[Backend][extract-s3] step=1_forward file=${filename} | FastAPI URL: ${FASTAPI_BASE_URL}, timeout: ${(timeout / 1000).toFixed(0)}s`);

      const { data } = await axios.post<ExtractedPOResponse>(
        `${FASTAPI_BASE_URL}/extract-invoice-from-s3`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const itemCount = Array.isArray(data?.items) ? data.items.length : 0;
      console.log(`[Backend][extract-s3] step=2_response file=${filename} | FastAPI extraction done in ${duration}s, items=${itemCount}`);

      return data;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`[Backend] Failed to extract PO from FastAPI (S3) after ${duration}s`);
      console.error(`[Backend] FastAPI URL: ${FASTAPI_BASE_URL}`);
      
      if (axios.isAxiosError(error)) {
        console.error(`[Backend] Axios error details:`, {
          code: error.code,
          message: error.message,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 500) 
              : error.response.data,
          } : undefined,
        });
        
        if (error.code === 'ECONNABORTED') {
          throw new Error(`FastAPI request timed out after ${timeout}ms (${(timeout / 1000).toFixed(0)}s). The PDF processing may be taking longer than expected.`);
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to FastAPI server at ${FASTAPI_BASE_URL}. Make sure the FastAPI server is running and the FASTAPI_URL environment variable is set correctly.`);
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
          throw new Error(`Connection to FastAPI server at ${FASTAPI_BASE_URL} timed out or was reset. This may indicate the server is overloaded or unreachable.`);
        }
        if (error.response) {
          const status = error.response.status;
          const statusText = error.response.statusText;
          const errorDetail = typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 200)
            : JSON.stringify(error.response.data).substring(0, 200);
          
          if (status === 502) {
            throw new Error(`FastAPI returned 502 Bad Gateway. This usually means: 1) FastAPI service is down or not responding, 2) Request timeout (Render has 60s timeout), 3) FastAPI service URL is incorrect. Check Render logs for FastAPI service.`);
          }
          throw new Error(`FastAPI returned error ${status}: ${statusText}. ${errorDetail ? `Details: ${errorDetail}` : ''}`);
        }
        if (error.request) {
          throw new Error(`No response from FastAPI server at ${FASTAPI_BASE_URL}. The server may be down or unreachable. Error: ${error.message}`);
        }
      }
      
      console.error(`[Backend] Unexpected error:`, error);
      throw new Error(`Failed to extract data from FastAPI: ${(error as Error).message}`);
    }
  },
};

