import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '@repo/db';
import poRoutes from './routes/po.routes';
import authRoutes from './routes/auth.routes';
import trackingRoutes from './routes/tracking.routes';
import { seedDefaultClients } from './seed/clients';
import { startTrackingCronJob } from './services/tracking-cron.service';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = express();

// CORS configuration - allow specific origins or all in development
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : '*', // Allow all origins if not specified (for development)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Increase JSON and URL-encoded body size limits to avoid 413 errors
// when saving reviewed purchase orders with many items.
// Adjust the limit if you expect significantly larger payloads.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend up and running (express)' });
});

app.use('/auth', authRoutes);
app.use('/po', poRoutes);
app.use('/tracking', trackingRoutes);

const startServer = async () => {
  await connectDB();
  await seedDefaultClients();

  // Start tracking cron job
  startTrackingCronJob();

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});    