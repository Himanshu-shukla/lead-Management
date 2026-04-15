import { Router } from 'express'; 
import { authenticateToken, requireAdmin, requireAuth } from '../middleware/auth';
import { getTeamPerformanceDashboard, getUserPerformanceDashboard } from '../controllers/performance.controller';
import { getUserAnalytics } from '../controllers/attendance.controller';

const router = Router();

router.use(authenticateToken, requireAuth);

// Correct: Just /team and /user/:userId
router.get('/team', requireAdmin, getTeamPerformanceDashboard);
router.get('/user/:userId', getUserPerformanceDashboard);
router.get('/:userId',getUserAnalytics);


export default router;