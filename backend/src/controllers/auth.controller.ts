import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_toko_key';

export const register = async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;
        // For now, returning mock success. Later we will integrate a DB.
        res.status(201).json({
            message: 'User registered successfully',
            user: { username, email }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error during registration' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Mock user for JWT generation test
        const token = jwt.sign({ id: 'mock_user_id', email }, JWT_SECRET, { expiresIn: '1h' });

        res.json({
            message: 'Login successful',
            token,
            user: { username: 'mock_user', email }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error during login' });
    }
};
