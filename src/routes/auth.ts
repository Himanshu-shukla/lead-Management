import { Router } from 'express';
import { 
  login, 
  register, 
  getMe, 
  updateProfile, 
  changePassword, 
  logout,
  dangerReset
} from '../controllers/authController';
import { authenticateToken, requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/logout', logout);

// Admin only registration route
router.post('/register', register);

// Protected routes
router.get('/me', authenticateToken, requireAuth, getMe);
router.put('/profile', authenticateToken, requireAuth, updateProfile);
router.put('/change-password', authenticateToken, requireAuth, changePassword);

// Admin-only danger routes
router.post('/danger-reset', authenticateToken, requireAdmin, dangerReset);

export default router;
