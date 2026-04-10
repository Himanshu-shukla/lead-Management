import express from 'express';
import { getStatuses, createStatus, deleteStatus, updateStatusOrder } from '../controllers/statusController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Get all statuses (accessible by all authenticated users)
router.get('/', authenticateToken, getStatuses);

// Create a new status (admin only)
router.post('/', authenticateToken, requireAdmin, createStatus);

// Delete a status (admin only)
router.delete('/:id', authenticateToken, requireAdmin, deleteStatus);

// Update status order (admin only)
router.put('/order', authenticateToken, requireAdmin, updateStatusOrder);

export default router;
