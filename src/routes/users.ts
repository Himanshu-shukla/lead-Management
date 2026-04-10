import { Router } from 'express';
import { 
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats
} from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All user routes require admin access
router.use(authenticateToken, requireAdmin);

// User statistics
router.get('/stats', getUserStats);

// CRUD operations
router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
