import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '@repo/db';
import poRoutes from './routes/po.routes';

dotenv.config();
connectDB();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = express();

// CORS configuration - allow specific origins or all in development
const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : '*', // Allow all origins if not specified (for development)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend up and running (express)' });
});

app.use('/po', poRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


