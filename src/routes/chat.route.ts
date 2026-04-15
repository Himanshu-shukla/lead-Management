import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { getAllChats } from '../controllers/leadController';
import { authenticateToken, requireAuth } from '../middleware/auth';

const router = Router();
router.use(authenticateToken, requireAuth);

router.get("/getChat",requireAdmin,getAllChats)

export default router;