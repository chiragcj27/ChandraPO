#!/usr/bin/env node

/**
 * Standalone script to create a client user account
 * Run with: npm run seed:client-user
 * 
 * Usage: npm run seed:client-user -- <email> <password> <clientName>
 * Example: npm run seed:client-user -- client@example.com password123 "Client Name"
 */

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectDB, User, Client } from '@repo/db';

dotenv.config();

async function main() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];
    const clientName = process.argv[4];

    if (!email || !password || !clientName) {
      console.log('❌ Usage: npm run seed:client-user -- <email> <password> <clientName>');
      console.log('   Example: npm run seed:client-user -- client@example.com password123 "Client Name"');
      process.exit(1);
    }

    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    // Find the client by name
    const client = await Client.findOne({ name: clientName.trim() });
    if (!client) {
      console.log(`❌ Client "${clientName}" not found in database.`);
      console.log('\nAvailable clients:');
      const allClients = await Client.find().sort({ name: 1 });
      if (allClients.length === 0) {
        console.log('  (No clients found)');
      } else {
        allClients.forEach((c) => {
          console.log(`  - ${c.name}`);
        });
      }
      console.log('\n💡 Tip: Create the client first, or use one of the existing client names above.');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      console.log(`❌ User with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create client user
    const clientUser = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'client',
      clientId: client._id,
      name: email.split('@')[0], // Use email prefix as default name
      isActive: true,
    });

    console.log(`✅ Client user created successfully!`);
    console.log(`Email: ${clientUser.email}`);
    console.log(`Role: ${clientUser.role}`);
    console.log(`Client: ${client.name}`);
    console.log(`Client ID: ${clientUser.clientId}`);
    console.log(`User ID: ${clientUser._id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating client user:', error);
    process.exit(1);
  }
}

main();


