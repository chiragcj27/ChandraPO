import { Request, Response } from 'express';
import { Client } from '@repo/db';

export const listClients = async (_req: Request, res: Response) => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    res.status(200).json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Failed to fetch clients' });
  }
};

export const upsertClient = async (req: Request, res: Response) => {
  try {
    const { name, mapping, description } = req.body || {};

    if (!name || !mapping) {
      return res.status(400).json({ message: 'name and mapping are required' });
    }

    const client = await Client.findOneAndUpdate(
      { name: name.trim() },
      {
        name: name.trim(),
        mapping,
        description: description ?? null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({ message: 'Client saved', client });
  } catch (error) {
    console.error('Error saving client:', error);
    res.status(500).json({ message: 'Failed to save client', error: (error as Error).message });
  }
};

export default { listClients, upsertClient };

