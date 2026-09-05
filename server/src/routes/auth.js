import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { strictLimiter } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', strictLimiter, ...auth.register);
router.post('/login', strictLimiter, ...auth.login);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);

export default router;