// controllers/salary.controller.ts
import { Request, Response } from 'express';
import { 
  SalaryService, 
 
} from '../service/salary.service';
import mongoose from 'mongoose';
import { sendError } from '../utils/sendError';

/**
 * Set or update employee salary (Admin only)
 * POST /api/salary/set/:userId
 */
export const setSalary = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return sendError(res, { 
        message: 'Access denied. Only HR admins can set salary details.',
        statusCode: 403 
      });
    }

    const { userId } = req.params;
    const adminId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, { 
        message: 'Invalid user ID format',
        statusCode: 400 
      });
    }

    const result = await SalaryService.setSalary(userId, req.body, adminId);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get employee salary by user ID
 * GET /api/salary/user/:userId
 */
export const getSalaryByUserId = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return sendError(res, { 
        message: 'User ID is required',
        statusCode: 400 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, { 
        message: 'Invalid user ID format',
        statusCode: 400 
      });
    }

    const result = await SalaryService.getSalaryByUserId(userId, currentUserId!, isAdmin);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get my salary (shortcut for current user)
 * GET /api/salary/me
 */
export const getMySalary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return sendError(res, { 
        message: 'Unauthorized. Please login again.',
        statusCode: 401 
      });
    }

    const result = await SalaryService.getSalaryByUserId(userId, userId, false);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get all salaries (Admin only)
 * GET /api/salary/all
 */
export const getAllSalaries = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, { 
        message: 'Access denied. Only HR admins can view all salaries.',
        statusCode: 403 
      });
    }

    const { department, isActive } = req.query;
    
    const filters: any = {};
    if (department) filters.department = department as string;
    if (isActive) filters.isActive = isActive === 'true';

    const result = await SalaryService.getAllSalaries(filters);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get salary revision history
 * GET /api/salary/history/:userId
 */
export const getSalaryHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return sendError(res, { 
        message: 'User ID is required',
        statusCode: 400 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, { 
        message: 'Invalid user ID format',
        statusCode: 400 
      });
    }

    // Check authorization
    if (!isAdmin && currentUserId !== userId) {
      return sendError(res, { 
        message: 'You can only view your own salary history',
        statusCode: 403 
      });
    }

    const result = await SalaryService.getSalaryHistory(userId);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Initialize leave policies (Admin only)
 * POST /api/salary/leave-policies/init
 */
export const initializeLeavePolicies = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, { 
        message: 'Access denied. Only HR admins can initialize leave policies.',
        statusCode: 403 
      });
    }

    const result = await SalaryService.initializeLeavePolicies();
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get all leave policies
 * GET /api/salary/leave-policies
 */
export const getLeavePolicies = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const result = await SalaryService.getLeavePolicies();
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get employee leave balance
 * GET /api/salary/leave-balance/:userId
 */
export const getLeaveBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { year } = req.query;
    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return sendError(res, { 
        message: 'User ID is required',
        statusCode: 400 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, { 
        message: 'Invalid user ID format',
        statusCode: 400 
      });
    }

    // Check authorization
    if (!isAdmin && currentUserId !== userId) {
      return sendError(res, { 
        message: 'You can only view your own leave balance',
        statusCode: 403 
      });
    }

    const targetYear = year ? parseInt(year as string) : undefined;
    const result = await SalaryService.getLeaveBalance(userId, targetYear);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get my leave balance (shortcut for current user)
 * GET /api/salary/my-leave-balance
 */
export const getMyLeaveBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;
    const { year } = req.query;
    
    if (!userId) {
      return sendError(res, { 
        message: 'Unauthorized. Please login again.',
        statusCode: 401 
      });
    }

    const targetYear = year ? parseInt(year as string) : undefined;
    const result = await SalaryService.getLeaveBalance(userId, targetYear);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Initialize holiday policy (Admin only)
 * POST /api/salary/holiday-policy/init
 */
export const initializeHolidayPolicy = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, { 
        message: 'Access denied. Only HR admins can initialize holiday policy.',
        statusCode: 403 
      });
    }

    const { year, holidays } = req.body;

    if (!year || !holidays) {
      return sendError(res, { 
        message: 'Year and holidays are required',
        statusCode: 400 
      });
    }

    const result = await SalaryService.initializeHolidayPolicy(year, holidays);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Get holiday policy
 * GET /api/salary/holiday-policy
 */
export const getHolidayPolicy = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : undefined;
    
    const result = await SalaryService.getHolidayPolicy(targetYear);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Generate salary slip
 * GET /api/salary/slip/:userId
 */
export const generateSalarySlip = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) {
      return sendError(res, { 
        message: 'User ID is required',
        statusCode: 400 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, { 
        message: 'Invalid user ID format',
        statusCode: 400 
      });
    }

    if (!month || !year) {
      return sendError(res, { 
        message: 'Month and year are required',
        statusCode: 400 
      });
    }

    // Check authorization
    if (!isAdmin && currentUserId !== userId) {
      return sendError(res, { 
        message: 'You can only view your own salary slips',
        statusCode: 403 
      });
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    if (monthNum < 1 || monthNum > 12) {
      return sendError(res, { 
        message: 'Invalid month. Must be between 1 and 12',
        statusCode: 400 
      });
    }

    const result = await SalaryService.generateSalarySlip(userId, monthNum, yearNum);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Generate my salary slip (shortcut for current user)
 * GET /api/salary/my-slip
 */
export const getMySalarySlip = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;
    const { month, year } = req.query;
    
    if (!userId) {
      return sendError(res, { 
        message: 'Unauthorized. Please login again.',
        statusCode: 401 
      });
    }

    if (!month || !year) {
      return sendError(res, { 
        message: 'Month and year are required',
        statusCode: 400 
      });
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    if (monthNum < 1 || monthNum > 12) {
      return sendError(res, { 
        message: 'Invalid month. Must be between 1 and 12',
        statusCode: 400 
      });
    }

    const result = await SalaryService.generateSalarySlip(userId, monthNum, yearNum);
    return res.status(200).json(result);
    
  } catch (error: any) {
    return sendError(res, error);
  }
};