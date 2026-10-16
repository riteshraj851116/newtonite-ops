import express from 'express';
import { login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema } from '../validations/schemas.js';

const router = express.Router();

router.post('/login', validateBody(loginSchema), login);
router.get('/me', protect, getMe);

export default router;
