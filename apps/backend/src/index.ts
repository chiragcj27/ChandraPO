import express from 'express';
import { connectDB } from '@repo/db';
import poRoutes from './routes/po.routes';

connectDB();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend up and running (express)' });
});

app.use('/po', poRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


