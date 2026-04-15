// routes/salary.routes.ts
import { Router } from 'express';
import { 
  setSalary,
  getSalaryByUserId,
  getMySalary,
  getAllSalaries,
  getSalaryHistory,
  initializeLeavePolicies,
  getLeavePolicies,
  getLeaveBalance,
  getMyLeaveBalance,
  initializeHolidayPolicy,
  getHolidayPolicy,
  generateSalarySlip,
  getMySalarySlip
} from '../controllers/salary.controller';
import { authenticateToken, requireAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken, requireAuth);

// ========== SALARY MANAGEMENT APIs ==========

// 1. Set/Update employee salary (Admin only)
router.post('/salary/set/:userId', setSalary);

// 2. Get salary by user ID
router.get('/salary/user/:userId', getSalaryByUserId);

// 3. Get my salary (current user)
router.get('/salary/me', getMySalary);

// 4. Get all salaries (Admin only)
router.get('/salary/all', getAllSalaries);

// 5. Get salary revision history
router.get('/salary/history/:userId', getSalaryHistory);

// ========== LEAVE POLICY APIs ==========

// 6. Initialize leave policies (Admin only - run once)
router.post('/salary/leave-policies/init', initializeLeavePolicies);

// 7. Get all leave policies
router.get('/salary/leave-policies', getLeavePolicies);

// 8. Get employee leave balance by user ID
router.get('/salary/leave-balance/:userId', getLeaveBalance);

// 9. Get my leave balance
router.get('/salary/my-leave-balance', getMyLeaveBalance);

// ========== HOLIDAY POLICY APIs ==========

// 10. Initialize holiday policy (Admin only)
router.post('/salary/holiday-policy/init', initializeHolidayPolicy);

// 11. Get holiday policy
router.get('/salary/holiday-policy', getHolidayPolicy);

// ========== SALARY SLIP APIs ==========

// 12. Generate salary slip for user
router.get('/salary/slip/:userId', generateSalarySlip);

// 13. Generate my salary slip
router.get('/salary/my-slip', getMySalarySlip);

export default router;