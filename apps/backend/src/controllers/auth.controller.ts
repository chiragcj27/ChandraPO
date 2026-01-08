import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Client } from '@repo/db';
import { JWT_SECRET } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  role: 'admin' | 'client';
  clientId?: string;
  name?: string;
}

/**
 * Generate JWT token for user
 */
const generateToken = (user: any): string => {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    clientId: user.clientId ? (typeof user.clientId === 'object' && user.clientId._id ? user.clientId._id.toString() : user.clientId.toString()) : null,
  };

  const secret = JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

/**
 * Login endpoint
 */
export const login = async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('clientId');
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({ message: 'Account is inactive' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken(user);

    // Return user info (without password) and token
    const userResponse: any = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name || user.email,
      username: user.username || null,
      clientId: user.clientId 
        ? (typeof user.clientId === 'object' && '_id' in user.clientId 
          ? user.clientId._id.toString() 
          : (user.clientId as mongoose.Types.ObjectId).toString()) 
        : null,
      clientName: user.clientId && typeof user.clientId === 'object' && 'name' in user.clientId 
        ? user.clientId.name 
        : null,
    };

    res.status(200).json({
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

/**
 * Register endpoint (admin only, but we'll make it accessible for now - you can restrict later)
 */
export const register = async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  try {
    const { email, password, role, clientId, name } = req.body;

    if (!email || !password || !role) {
      res.status(400).json({ message: 'Email, password, and role are required' });
      return;
    }

    // Validate role
    if (!['admin', 'client'].includes(role)) {
      res.status(400).json({ message: 'Invalid role. Must be "admin" or "client"' });
      return;
    }

    // If client role, clientId is required
    if (role === 'client' && !clientId) {
      res.status(400).json({ message: 'clientId is required for client role' });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(400).json({ message: 'User with this email already exists' });
      return;
    }

    // If client role, verify client exists
    if (role === 'client' && clientId) {
      const client = await Client.findById(clientId);
      if (!client) {
        res.status(400).json({ message: 'Client not found' });
        return;
      }
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      clientId: role === 'client' && clientId ? clientId : null,
      name: name || email.split('@')[0],
      isActive: true,
    });

    // Generate token
    const token = generateToken(user);

    // Return user info (without password) and token
    const userResponse: any = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name || user.email,
      clientId: user.clientId ? user.clientId.toString() : null,
    };

    res.status(201).json({
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
};

/**
 * Get current user endpoint
 */
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user.userId).populate('clientId');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const userResponse: any = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name || user.email,
      username: user.username || null,
      clientId: user.clientId 
        ? (typeof user.clientId === 'object' && '_id' in user.clientId 
          ? user.clientId._id.toString() 
          : (user.clientId as mongoose.Types.ObjectId).toString()) 
        : null,
      clientName: user.clientId && typeof user.clientId === 'object' && 'name' in user.clientId 
        ? user.clientId.name 
        : null,
    };

    res.status(200).json({ user: userResponse });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
};

export default { login, register, getCurrentUser };


