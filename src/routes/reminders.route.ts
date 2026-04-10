import { Router } from 'express';
import {
  genRem,
  getMyReminders,
  getReminderById,
  updateReminder,
  deleteReminder,
  updateReminderDetails, // 👈 NEW FUNCTION
} from '../controllers/reminder.controller';
import { authenticateToken, requireAuth } from '../middleware/auth';

const router = Router();

// All require auth
router.use(authenticateToken, requireAuth);

// Create a reminder
router.post('/', genRem);

// Get all my reminders
router.get('/my', getMyReminders);

// Get single reminder
router.get('/:id', getReminderById);

// Update reminder status/snooze (PATCH)
router.patch('/:id', updateReminder);

// Update reminder details (title, note, date) - PUT
router.put('/:id', updateReminderDetails); // 👈 SEPARATE FOR DETAILS

// Delete reminder
router.delete('/:id', deleteReminder);

export default router;