#!/usr/bin/env node

/**
 * Standalone script to seed/update client mappings in the database
 * Run with: npm run seed:clients (or tsx src/scripts/seed-clients.ts)
 */

import dotenv from 'dotenv';
import { connectDB } from '@repo/db';
import { seedDefaultClients } from '../seed/clients';

dotenv.config();

async function main() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    console.log('Seeding clients...');
    await seedDefaultClients();
    console.log('✅ Clients seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding clients:', error);
    process.exit(1);
  }
}

main();

