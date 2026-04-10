import { Router } from 'express';
import { 
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  assignLeads,
  unassignLeads,
  bulkUpdateStatus,
  addNote,
  getMyLeads,
  getMyLeadsStats,
  getDistinctFolders,
  getFolderCounts,
  importLeadsFromGoogleSheet,
  getDuplicateAndUncategorizedCounts,
  searchLeads,

} from '../controllers/leadController';
import { 
  analyzeExcelFile,
  getSheetPreview,
  importWithMapping,
  getLeadFields
} from '../controllers/excelController';
import { uploadExcel, handleUploadError, validateFilePresence } from '../middleware/upload';
import { authenticateToken, requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// All lead routes require authentication
router.use(authenticateToken, requireAuth);





/* =============== LEAD FILTER & USER ROUTES =============== */
// My leads endpoint (for users to see their assigned leads)
router.get('/my-leads', getMyLeads);

// My leads stats endpoint
router.get('/my-leads/stats', getMyLeadsStats);

// Get distinct folders for filtering
router.get('/folders', getDistinctFolders);

// Get folder counts for better performance
router.get('/folder-counts', getFolderCounts);

/* =============== BULK / ASSIGNMENT =============== */
// Lead assignment (admin only)
router.post('/assign', requireAdmin, assignLeads);

// Lead unassignment (admin only)
router.post('/unassign', requireAdmin, unassignLeads);

// Bulk update lead status
router.put('/bulk-status', bulkUpdateStatus);

/* =============== LEAD NOTES =============== */
// Add note to lead
router.post('/notes', addNote);

/* =============== EXCEL / IMPORT =============== */
// Smart Excel import endpoints (admin only)
router.get('/import/fields', requireAdmin, getLeadFields);

router.post(
  '/import/analyze',
  requireAdmin,
  uploadExcel,
  handleUploadError,
  validateFilePresence,
  analyzeExcelFile
);

router.post(
  '/import/preview',
  requireAdmin,
  uploadExcel,
  handleUploadError,
  validateFilePresence,
  getSheetPreview
);

router.post(
  '/import',
  requireAdmin,
  uploadExcel,
  handleUploadError,
  validateFilePresence,
  importWithMapping
);

router.post(
  '/import/google-sheet',
  requireAdmin,
  importLeadsFromGoogleSheet
);

/* =============== LEAD CRUD =============== */
// Get all leads (filtered by role)
router.get('/', getLeads);

router.get('/search',searchLeads)

// Get single lead by ID
router.get('/:id', getLeadById);

// Create a new lead
router.post('/', createLead);

// Update a lead
router.put('/:id', updateLead);

// Delete a lead (admin only)
router.delete('/:id', requireAdmin, deleteLead);

// Summary counters
router.get('/counts/summary', getDuplicateAndUncategorizedCounts);

export default router;
