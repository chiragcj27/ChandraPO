import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import type { ExtractedPOResponse } from '../types/po';

dotenv.config();

const FASTAPI_BASE_URL = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/$/, '');

export const fastapiService = {
  async extractPurchaseOrder(file: Express.Multer.File): Promise<ExtractedPOResponse> {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      knownLength: file.size,
    });

    const timeout = Number(process.env.FASTAPI_TIMEOUT_MS || 600000); // Default 10 minutes (600000ms)
    const startTime = Date.now();

    try {
      console.log(`Starting FastAPI extraction for file: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
      
      const { data } = await axios.post<ExtractedPOResponse>(
        `${FASTAPI_BASE_URL}/extract-invoice`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout,
        },
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`FastAPI extraction completed in ${duration}s for file: ${file.originalname}`);

      return data;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`Failed to extract PO from FastAPI after ${duration}s:`, error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(`FastAPI request timed out after ${timeout}ms (${(timeout / 1000).toFixed(0)}s). The PDF processing may be taking longer than expected. Consider increasing FASTAPI_TIMEOUT_MS environment variable.`);
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to FastAPI server at ${FASTAPI_BASE_URL}. Make sure the FastAPI server is running.`);
        }
        if (error.response) {
          throw new Error(`FastAPI returned error ${error.response.status}: ${error.response.statusText}`);
        }
      }
      throw new Error('Failed to extract data from FastAPI');
    }
  },
};

