// controllers/hr.controller.ts
import { Request, Response } from 'express';
import { HRService, ValidationError, UnauthorizedError } from '../service/hr.service';
import { sendError } from '../utils/sendError';
import mongoose from 'mongoose';

/**
 * Employees apply for their own leave.
 */
export const applyLeave = async (req: Request, res: Response) => {
  try {
    // RBAC: Take the ID from the token/session, not the request body
    const leaveData = {
      ...req.body,
      user: req.user?.userId // This ensures the 'user' path is populated
    };

    if (!leaveData.user) {
      throw new ValidationError("Authentication required: No user ID found.");
    }

    const leave = await HRService.applyLeave(leaveData);
    return res.status(201).json({ 
      success: true, 
      message: 'Leave application submitted successfully',
      data: leave 
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get my leaves (for current user)
 */
export const getMyLeaves = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { year } = req.query;

    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    const result = await HRService.getUserLeaves(
      userId, 
      year ? parseInt(year as string) : undefined
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Cancel my leave
 */
export const cancelMyLeave = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid leave ID format");
    }

    const result = await HRService.cancelLeave(id, userId);
    return res.status(200).json(result);
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * RBAC: Only Admin can view all pending leaves.
 */
export const getPendingLeaves = async (req: Request, res: Response) => {
  try {
    // RBAC Check
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Admin privileges required.');
    }

    const { department, leaveType } = req.query;
    const filters: any = {};
    
    if (department) filters.department = department as string;
    if (leaveType) filters.leaveType = leaveType as string;

    const pendingLeaves = await HRService.getPendingLeaves(filters);
    return res.status(200).json({
      success: true,
      data: pendingLeaves
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get all leaves with filters (Admin)
 */
export const getAllLeaves = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Admin privileges required.');
    }

    const { leaveType } = req.query;

    // This would need a new service method
    // For now, using getPendingLeaves as placeholder
    const result = await HRService.getPendingLeaves({ leaveType: leaveType as string });
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * RBAC: Only Admin can approve/reject leaves.
 */
export const updateLeaveStatus = async (req: Request, res: Response) => {
  try {
    // RBAC Check
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Only admins can update leave status.');
    }

    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid leave ID format");
    }
    
    const result = await HRService.updateLeaveStatus(id, status, adminId, rejectionReason);
    return res.status(200).json(result);
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get leave statistics (Admin)
 */
export const getLeaveStatistics = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Admin privileges required.');
    }

    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : undefined;

    const stats = await HRService.getLeaveStatistics(targetYear);
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * RBAC: Only Admin can add company holidays.
 */
export const addHoliday = async (req: Request, res: Response) => {
  try {
    // RBAC Check
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Admin privileges required to add holidays.');
    }

    const holiday = await HRService.addHoliday(req.body);
    return res.status(201).json({ 
      success: true, 
      message: 'Holiday added successfully',
      data: holiday 
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Public/Employee view of holidays.
 */
export const getHolidays = async (req: Request, res: Response) => {
  try {
    const { year, type } = req.query;
    const holidays = await HRService.getHolidays(year as string, type as string);
    return res.status(200).json({ 
      success: true, 
      data: holidays 
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Update holiday (Admin only)
 */
export const updateHoliday = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Admin privileges required.');
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid holiday ID format");
    }

    const result = await HRService.updateHoliday(id, req.body);
    return res.status(200).json(result);
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Delete holiday (Admin only)
 */
export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedError('Access denied. Admin privileges required.');
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid holiday ID format");
    }

    const result = await HRService.deleteHoliday(id);
    return res.status(200).json(result);
  } catch (error: any) {
    return sendError(res, error);
  }
};