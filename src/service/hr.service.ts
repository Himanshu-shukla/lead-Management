// services/hr.service.ts
import { Leave } from '../models/Leave';
import { Holiday } from '../models/Holiday';
import { SalaryService } from './salary.service';
import { LeavePolicy } from '../models/leaveAndPay';
import mongoose from 'mongoose';
interface HolidayGroup {
  [key: string]: any[];
}
// Custom Error Classes
export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class UnauthorizedError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 403;
  }
}

export class ConflictError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

export const HRService = {
  /**
   * Apply for leave with policy validation
   */
  applyLeave: async (leaveData: any) => {
    const { user, startDate, endDate, leaveType, reason } = leaveData;
  
    // Manual check before Mongoose validation kicks in
    if (!user) {
      throw new ValidationError("User ID is required to process leave.");
    }
  
    if (!leaveType) {
      throw new ValidationError("Leave type is required.");
    }
  
    // Validate dates
    if (!startDate || !endDate) {
      throw new ValidationError("Start date and end date are required.");
    }
  
    // Check date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ValidationError("Invalid date format. Please use YYYY-MM-DD format.");
    }
  
    const start = new Date(startDate);
    const end = new Date(endDate);
  
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError("Invalid date values.");
    }
  
    // Check if start date is before or equal to end date
    if (start > end) {
      throw new ValidationError("Start date cannot be after end date.");
    }

    // Check if applying for past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new ValidationError("Cannot apply for leave on past dates.");
    }
  
    // Calculate total days
    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;
  
    // Validate totalDays is a positive number
    if (totalDays <= 0 || isNaN(totalDays)) {
      throw new ValidationError("Invalid date range. Please check your dates.");
    }

    // Check maximum leave days per application (optional)
    if (totalDays > 30) {
      throw new ValidationError("Cannot apply for more than 30 days in a single request.");
    }
  
    // Check for overlapping leave requests
    const overlappingLeave = await Leave.findOne({
      user,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    });

    if (overlappingLeave) {
      throw new ConflictError("You already have a pending or approved leave for this period.");
    }
  
    // Get leave policy for this leave type
    const policy = await LeavePolicy.findOne({ leaveType });
    
    if (!policy) {
      throw new NotFoundError(`Leave policy not found for type: ${leaveType}`);
    }

    // Check leave balance before applying
    try {
      const currentYear = new Date().getFullYear();
      const balance = await SalaryService.getLeaveBalance(user, currentYear);
      const leaveBalance = balance.data.balances.find((b: any) => b.leaveType === leaveType);
      
      if (!leaveBalance) {
        throw new ValidationError(`Leave type ${leaveType} is not configured for this employee.`);
      }

      if (leaveBalance.remaining < totalDays) {
        throw new ValidationError(
          `Insufficient ${leaveType} leave balance. ` +
          `Available: ${leaveBalance.remaining} days, Requested: ${totalDays} days`
        );
      }

      // Check minimum service days requirement
      if (policy.minServiceDays && policy.minServiceDays > 0) {
        // This would need employee joining date - you can implement if needed
        // For now, just a placeholder
        console.log('Minimum service days check would go here');
      }

    } catch (balanceError) {
      if (balanceError instanceof ValidationError) {
        throw balanceError;
      }
      console.error('Leave balance check failed:', balanceError);
      // Optionally, you can still allow leave application even if balance check fails
      // throw new Error('Unable to verify leave balance. Please try again.');
    }
  
    // Create the leave document
    return await Leave.create({ 
      user,
      leaveType,
      startDate,
      endDate,
      reason,
      totalDays,
      status: 'Pending'
    });
  },

  /**
   * Get all pending leaves with filters
   */
 
    getPendingLeaves: async (filters?: { department?: string; leaveType?: string }) => {
      try {
        const query: any = { status: 'Pending' };
        
        if (filters?.leaveType) {
          query.leaveType = filters.leaveType;
        }
  
        // 1. Use .lean() to get plain objects and fix the "complex union" error
        let leaves = await Leave.find(query)
          .populate({
            path: 'user',
            select: 'name email phone department',
            // populate: {
            //   path: 'department',
            //   select: 'name'
            // }
          })
          .sort({ createdAt: -1 })
          .lean(); // <-- This is the magic fix
  
        // 2. Filter by department if specified
        if (filters?.department) {
          leaves = leaves.filter((leave: any) => {
            // Check if populated department ID or Name matches filter
            const dept = leave.user?.department;
            return dept === filters.department || dept?.name === filters.department;
          });
        }
  
        // 3. Group by leave type for summary
        const summary = leaves.reduce((acc: any, leave: any) => {
          const type = leave.leaveType;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
  
        return {
          success: true,
          data: {
            leaves,
            summary,
            total: leaves.length
          }
        };
      } catch (error) {
        throw error;
      }
    },
  

  /**
   * Update leave status with transaction support
   */
  updateLeaveStatus: async (id: string, status: string, adminId: string, rejectionReason?: string) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existingLeave = await Leave.findById(id).session(session);
      
      if (!existingLeave) throw new NotFoundError("Leave record not found");
      if (existingLeave.status !== 'Pending') throw new ValidationError(`Leave is already ${existingLeave.status}`);
      if (!['Approved', 'Rejected'].includes(status)) throw new ValidationError("Status must be either 'Approved' or 'Rejected'");
      if (status === 'Rejected' && !rejectionReason) throw new ValidationError("Rejection reason is required");

      const updateData: any = { status, approvedBy: adminId };
      if (status === 'Rejected' && rejectionReason) updateData.rejectionReason = rejectionReason;

      const leave = await Leave.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true, session }
      );

      // If leave is approved, update the balance
      if (status === 'Approved') {
        // REMOVED: Inner try-catch. Let the main catch handle the abort.
        await SalaryService.updateLeaveBalanceAfterApproval(
          existingLeave.user._id,
          existingLeave.leaveType,
          existingLeave.totalDays,
          session
        );
      }

      await session.commitTransaction();
      return { success: true, message: `Leave ${status} successfully`, data: leave };
      
    } catch (error) {
      // One single place to abort
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      // Always end the session in finally to ensure it closes whether success or failure
      session.endSession();
    }
  },
  /**
   * Get leaves for a specific user
   */
  getUserLeaves: async (userId: string, year?: number) => {
    const query: any = { user: userId };
    
    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query.startDate = { $gte: startOfYear };
      query.endDate = { $lte: endOfYear };
    }

    const leaves = await Leave.find(query).sort({ createdAt: -1 });

    // Get leave balance for context
    const currentYear = year || new Date().getFullYear();
    const balance = await SalaryService.getLeaveBalance(userId, currentYear);

    // Calculate statistics
    const stats = {
      total: leaves.length,
      approved: leaves.filter(l => l.status === 'Approved').length,
      pending: leaves.filter(l => l.status === 'Pending').length,
      rejected: leaves.filter(l => l.status === 'Rejected').length,
      cancelled: leaves.filter(l => l.status === 'Cancelled').length,
      totalDays: leaves.reduce((sum, l) => sum + l.totalDays, 0),
      approvedDays: leaves
        .filter(l => l.status === 'Approved')
        .reduce((sum, l) => sum + l.totalDays, 0)
    };

    return {
      leaves,
      stats,
      balance: balance.data
    };
  },

  /**
   * Cancel leave (employee can cancel their pending leave)
   */
  cancelLeave: async (leaveId: string, userId: string) => {
    const leave = await Leave.findById(leaveId);
    
    if (!leave) {
      throw new NotFoundError("Leave record not found");
    }

    // Check if user owns this leave
    if (leave.user.toString() !== userId) {
      throw new UnauthorizedError("You can only cancel your own leave requests");
    }

    // Can only cancel pending leaves
    if (leave.status !== 'Pending') {
      throw new ValidationError(`Cannot cancel leave with status: ${leave.status}`);
    }

    leave.status = 'Cancelled';
    await leave.save();

    return {
      success: true,
      message: 'Leave cancelled successfully',
      data: leave
    };
  },

  /**
   * Add holiday with duplicate check
   */
  addHoliday: async (holidayData: any) => {
    const { name, date, type } = holidayData;

    if (!name || !date || !type) {
      throw new ValidationError("Name, date, and type are required");
    }

    // Check for duplicate holiday on same date
    const existingHoliday = await Holiday.findOne({ date });
    if (existingHoliday) {
      throw new ConflictError(`Holiday already exists on ${date}`);
    }

    return await Holiday.create(holidayData);
  },

  /**
   * Get holidays with filters
   */
  getHolidays: async (year?: string, type?: string) => {
    try {
      let query: any = {};
      
      if (year) {
        // Note: If date is a Date object in DB, $regex won't work. 
        // Use $gte and $lte for Date objects. 
        // If date is a string, $regex is fine.
        query.date = { $regex: `^${year}` };
      }

      if (type) {
        query.type = type;
      }

      // FIX #1: Added .lean() to convert Mongoose Documents to plain objects
      const holidays = await Holiday.find(query).sort({ date: 1 }).lean();

      // FIX #2: Explicitly type 'acc' as HolidayGroup and cast initial value '{}'
      const groupedByMonth = holidays.reduce((acc: HolidayGroup, holiday: any) => {
        const dateObj = new Date(holiday.date);
        
        // Safety check for invalid dates
        if (isNaN(dateObj.getTime())) return acc;

        const month = dateObj.toLocaleString('default', { month: 'long' });
        
        if (!acc[month]) {
          acc[month] = [];
        }
        acc[month].push(holiday);
        return acc;
      }, {} as HolidayGroup);

      return {
        success: true,
        data: {
          holidays,
          groupedByMonth,
          total: holidays.length,
          year: year || 'all'
        }
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update holiday (admin only)
   */
  updateHoliday: async (id: string, updateData: any) => {
    const holiday = await Holiday.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!holiday) {
      throw new NotFoundError("Holiday not found");
    }

    return {
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    };
  },

  /**
   * Delete holiday (admin only)
   */
  deleteHoliday: async (id: string) => {
    const holiday = await Holiday.findByIdAndDelete(id);

    if (!holiday) {
      throw new NotFoundError("Holiday not found");
    }

    return {
      success: true,
      message: 'Holiday deleted successfully'
    };
  },

  /**
   * Get leave statistics for admin dashboard
   */
  getLeaveStatistics: async (year?: number) => {
    const targetYear = year || new Date().getFullYear();
    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31`;

    const leaves = await Leave.find({
      startDate: { $gte: startDate },
      endDate: { $lte: endDate }
    }).populate('user', 'name department');

    // Overall statistics
    const overall = {
      total: leaves.length,
      approved: leaves.filter(l => l.status === 'Approved').length,
      pending: leaves.filter(l => l.status === 'Pending').length,
      rejected: leaves.filter(l => l.status === 'Rejected').length,
      cancelled: leaves.filter(l => l.status === 'Cancelled').length,
      totalDays: leaves.reduce((sum, l) => sum + l.totalDays, 0)
    };

    // Statistics by leave type
    const byLeaveType = leaves.reduce((acc: any, leave) => {
      if (!acc[leave.leaveType]) {
        acc[leave.leaveType] = { count: 0, days: 0 };
      }
      acc[leave.leaveType].count += 1;
      acc[leave.leaveType].days += leave.totalDays;
      return acc;
    }, {});

    // Statistics by month
    const byMonth = leaves.reduce((acc: any, leave) => {
      const month = new Date(leave.startDate).getMonth() + 1;
      if (!acc[month]) {
        acc[month] = { count: 0, days: 0 };
      }
      acc[month].count += 1;
      acc[month].days += leave.totalDays;
      return acc;
    }, {});

    // Most leave-prone employees
    const topEmployees = leaves
      .filter(l => l.status === 'Approved')
      .reduce((acc: any, leave) => {
        const userId = leave.user.toString();
        if (!acc[userId]) {
          acc[userId] = {
            userId,
            userName: (leave.user as any)?.name || 'Unknown',
            totalDays: 0,
            leaves: []
          };
        }
        acc[userId].totalDays += leave.totalDays;
        acc[userId].leaves.push({
          type: leave.leaveType,
          days: leave.totalDays,
          startDate: leave.startDate
        });
        return acc;
      }, {});

    const topEmployeesList = Object.values(topEmployees)
      .sort((a: any, b: any) => b.totalDays - a.totalDays)
      .slice(0, 5);

    return {
      year: targetYear,
      overall,
      byLeaveType,
      byMonth,
      topEmployees: topEmployeesList
    };
  }
};