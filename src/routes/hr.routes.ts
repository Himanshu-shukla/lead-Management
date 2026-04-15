import { Router } from 'express';
import * as HRController from '../controllers/hr.controller';
import * as PayrollController from '../controllers/payroll.controller';
import { authenticateToken, requireAuth } from '../middleware/auth';
import { deleteDocument, getMyDocuments, getPendingVerifications, getUserDocuments, uploadDocument, verifyDocument } from '../controllers/document.controller';

const router = Router();
router.use(authenticateToken, requireAuth);

// --- Leave Management ---
// Endpoint for employees to submit a leave request
router.post('/leaves/apply', HRController.applyLeave); 

// Endpoint for admins to view all pending leave requests
router.get('/leaves/admin/pending', HRController.getPendingLeaves); 

// Endpoint for admins to approve or reject a leave request
router.patch('/leaves/status/:id', HRController.updateLeaveStatus); 

// --- Holiday Management ---
// Endpoint for admins to add a new public holiday
router.post('/holidays', HRController.addHoliday); 

// Endpoint to fetch the company holiday list
router.get('/holidays', HRController.getHolidays); 

// --- Payroll Management ---
// Endpoint to generate a specific employee's salary slip data
router.get('/payroll/slip/:userId', PayrollController.getSalarySlipData); 

// Endpoint for admins to see the company-wide payroll summary
router.get('/payroll/summary', PayrollController.getCompanyPayrollSummary);
router.post('/documents/upload', uploadDocument);
// router.post('/documents/upload', upload.single('document'), uploadDocument); // Production version

// 2. Verify document (Admin only)
router.patch('/documents/verify/:docId', verifyDocument);

// 3. Delete document
router.delete('/documents/:docId', deleteDocument);

// 4. Get all documents by user ID
router.get('/documents/user/:userId', getUserDocuments);

// 5. Get my documents (shortcut for current user)
router.get('/documents/me', getMyDocuments);

// 6. Get all pending verifications (Admin only)
router.get('/documents/pending-verifications', getPendingVerifications);
export default router;