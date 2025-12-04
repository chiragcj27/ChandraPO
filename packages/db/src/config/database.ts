import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Only load .env file in development (when it exists)
// In production, environment variables are provided directly by the platform
try {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
} catch {
  // .env file doesn't exist in production, which is fine
}

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in the environment variables');
    }

    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB; 