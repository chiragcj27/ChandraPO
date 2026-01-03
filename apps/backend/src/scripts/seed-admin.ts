#!/usr/bin/env node

/**
 * Standalone script to create an admin user
 * Run with: tsx src/scripts/seed-admin.ts
 * 
 * Usage: tsx src/scripts/seed-admin.ts <email> <password>
 */

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectDB, User } from '@repo/db';

dotenv.config();

async function main() {
  try {
    const email = process.argv[2] || 'admin@chandra.com';
    const password = process.argv[3] || 'admin123';

    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    // Check if admin user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      console.log(`❌ User with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const adminUser = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin',
      name: 'Administrator',
      isActive: true,
    });

    console.log(`✅ Admin user created successfully!`);
    console.log(`Email: ${adminUser.email}`);
    console.log(`Role: ${adminUser.role}`);
    console.log(`ID: ${adminUser._id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

main();


