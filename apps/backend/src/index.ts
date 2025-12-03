import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '@repo/db';
import poRoutes from './routes/po.routes';

dotenv.config();
connectDB();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend up and running (express)' });
});

app.use('/po', poRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


