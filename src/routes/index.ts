import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import leadRoutes from './leads';
import dashboardRoutes from './dashboard';
import statusRoutes from './status';
import remindersRouter from './reminders.route'
const router = Router();
// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/leads', leadRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/statuses', statusRoutes);
router.use('/reminders', remindersRouter);
// Health check for API
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
