import { Request, Response } from 'express';
import Reminder from '../models/reminder'; //  IMPORT THE MODEL
import User from '../models/User'; // Assuming you have User model
import Lead from '../models/Lead'; // Assuming you have Lead model
import { sendError } from '../utils/sendError';

export const getMyReminders = async (req: Request, res: Response) => {
  try {
    // Auth safety check
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const reminders = await Reminder.find({
      user: req.user.userId,
      action: { $ne: 'done' },
    })
      .populate('lead', 'name email phone')   //  POPULATE LEAD
      .populate('user', 'name email')         //  optional but useful
      .sort({ remindAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return sendError(res, error, 500);
  }
};


export const deleteReminder = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;

    //  Use correct model name
    const deleted = await Reminder.findOneAndDelete({
      _id: id,
      user: req.user.userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    return res.json({
      success: true,
      message: 'Reminder deleted successfully',
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return sendError(res, error, 500);
  }
};

export const updateReminder = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const { remindAt, status, action, snoozeUntil } = req.body;

    // Handle both new API format (action-based) and old format
    let updateData: any = {};

    // New API format with 'action' parameter
    if (action === 'snooze' && snoozeUntil) {
        // Validate the snoozeUntil date
        const snoozeDate = new Date(snoozeUntil);
        const now = new Date();
        
        // Make sure snooze date is in the future
        if (snoozeDate <= now) {
          return res.status(400).json({
            success: false,
            message: 'Snooze time must be in the future',
          });
        }
        
        updateData.remindAt = snoozeDate;
        updateData.status = 'pending';
        
        console.log('Snoozing reminder:', {
          reminderId: id,
          snoozeUntil: snoozeDate.toISOString(),
          fromTime: new Date().toISOString()
        });
      } else if (action === 'done') {
      updateData.action='done'
      updateData.status = 'triggered';
    }
    // Old format (backward compatibility)
    else if (remindAt) {
      updateData.remindAt = new Date(remindAt);
      updateData.status = 'pending';
    } else if (status === 'triggered' || status === 'done') {
      updateData.status = 'triggered';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid update data. Provide action (snooze/done) with snoozeUntil for snooze, or status/remindAt',
      });
    }

    //  Use correct model name
    const updated = await Reminder.findOneAndUpdate(
      {
        _id: id,
        user: req.user.userId,
      },
      updateData,
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    return res.json({
      success: true,
      data: updated,
      message: 'Reminder updated successfully',
    });
  } catch (error: any) {
    console.error('Update reminder error:', error);
    return sendError(res, error, 500);
  }
};

export const updateReminderDetails = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const { title, note, reminderAt } = req.body;

    // Validate
    if (!title && !note && !reminderAt) {
      return res.status(400).json({
        success: false,
        message: 'At least one field to update is required',
      });
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (note !== undefined) updateData.note = note;
    if (reminderAt) updateData.remindAt = new Date(reminderAt);

    //  Use correct model name
    const updated = await Reminder.findOneAndUpdate(
      {
        _id: id,
        user: req.user.userId,
      },
      updateData,
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    return res.json({
      success: true,
      data: updated,
      message: 'Reminder details updated successfully',
    });
  } catch (error) {
    console.error('Update reminder details error:', error);
    return sendError(res, error, 500);
  }
};

export const getReminderById = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;

    //  Use correct model name
    const reminder = await Reminder.findOne({
      _id: id,
      user: req.user.userId,
    })
      .populate('lead', 'name email phone') // Include more lead fields if needed
      .lean();

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    return res.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    console.error('Get single reminder error:', error);
    return sendError(res, error, 500);
  }
};

export const genRem = async (req: Request, res: Response) => {
  console.log("[REMINDER API HIT]");
  console.log("📥 Request Body:", req.body);
  console.log("👤 User ID:", req.user?.userId);

  try {
    const { leadId, title, note, remindAt } = req.body;

    /* =========================
       BASIC VALIDATION
    ========================= */
    if (!leadId || !title || !remindAt) {
      return res.status(400).json({
        success: false,
        message: "leadId, title and remindAt are required"
      });
    }

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    /* =========================
       CHECK USER
    ========================= */
    const user = await User.findById(req.user.userId).select("isActive");
    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is inactive or not found"
      });
    }

    /* =========================
       CHECK LEAD
    ========================= */
    const lead = await Lead.findById(leadId).select("name");
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    /* =========================
       CREATE REMINDER
    ========================= */
    //  Use correct model name
    const newReminder = await Reminder.create({
      user: req.user.userId,
      lead: leadId,
      title: title.trim(),
      note: note?.trim(),
      remindAt: new Date(remindAt),
      status: "pending"
    });

    console.log(" Reminder created:", newReminder._id);

    return res.status(201).json({
      success: true,
      message: "Reminder created successfully",
      data: newReminder
    });

  } catch (error: any) {
    console.error("🔥 CREATE REMINDER ERROR:", error.message);
    return sendError(res, error, 500);
  }
};