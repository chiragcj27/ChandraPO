import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/admin-signup', authController.adminSignup);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;


