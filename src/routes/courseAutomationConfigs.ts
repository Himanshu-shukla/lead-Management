import { Router } from 'express';
import {
  createCourseAutomationConfig,
  deleteCourseAutomationConfig,
  getCourseAutomationConfigById,
  getCourseAutomationConfigs,
  updateCourseAutomationConfig,
} from '../controllers/courseAutomationConfigController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/', getCourseAutomationConfigs);
router.get('/:id', getCourseAutomationConfigById);
router.post('/', createCourseAutomationConfig);
router.put('/:id', updateCourseAutomationConfig);
router.delete('/:id', deleteCourseAutomationConfig);

export default router;
