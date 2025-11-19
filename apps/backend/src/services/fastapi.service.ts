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

    try {
      const { data } = await axios.post<ExtractedPOResponse>(
        `${FASTAPI_BASE_URL}/extract-invoice`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: Number(process.env.FASTAPI_TIMEOUT_MS || 120000),
        },
      );

      return data;
    } catch (error) {
      console.error('Failed to extract PO from FastAPI:', error);
      throw new Error('Failed to extract data from FastAPI');
    }
  },
};

