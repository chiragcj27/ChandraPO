import { Request, Response } from 'express';
import { PO } from '@repo/db';

export const getPOs = async (req: Request, res: Response) => {
    try {
        const pos = await PO.find().sort({ poDate: -1 });
        res.status(200).json({
            status: 'success',
            data: pos
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch POs' });
    }
}
export default { getPOs };