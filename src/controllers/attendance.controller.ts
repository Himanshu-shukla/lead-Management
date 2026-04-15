import { Request, Response } from 'express';
import { AttendanceService, getAttendanceReportService } from '../service/attendance.service';
import { sendError } from '../utils/sendError';
import { Attendance } from '../models/attendance.model';

/**
 * Handle User Clock-In
 * Validates location and creates an attendance record
 */
/**
 * Handle User Clock-In
 */
export const clockIn = async (req: Request, res: Response): Promise<void> => {
    try {
      const { lat, lng } = req.body;
      const userId = req.user?.userId;
  
      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }
  
      if (lat === undefined || lng === undefined) {
        res.status(400).json({
          success: false,
          message: 'Location data is required'
        });
        return;
      }
  
      const data = await AttendanceService.clockIn(userId.toString(), lat, lng);
  
      res.status(201).json({
        success: true,
        message: 'Clocked in successfully',
        data
      });
    } catch (error: any) {
      console.error('Clock-in error:', error);
      sendError(res, error, 400);
    }
  };
  
  /**
   * Handle User Clock-Out
   */
  export const clockOut = async (req: Request, res: Response): Promise<void> => {
    try {
      //  Provide defaults to avoid "Cannot destructure property" error
      const { lat = 0, lng = 0 } = req.body || {}; 
      const userId = req.user?.userId;
  
      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }
  
      // The service will decide if these coordinates matter based on WFH status
      const data = await AttendanceService.clockOut(userId.toString(), lat, lng);
  
      res.status(200).json({
        success: true,
        message: 'Clocked out successfully',
        data
      });
    } catch (error: any) {
      sendError(res, error, 400);
    }
  };
  /**
   * Get Current Status for UI State & Lockdown
   */
  export const getAttendanceStatus = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      const todayStr = new Date().toISOString().split('T')[0];
  
      // Check for today's active record (source of truth)
      const activeSession = await Attendance.findOne({
        user: userId,
        date: todayStr,
        checkOut: null 
      });
  
      res.status(200).json({
        success: true,
        data: {
          isClockedIn: !!activeSession, 
          checkInTime: activeSession ? activeSession.checkIn : null
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error checking status" });
    }
  };

/**
 * Get Attendance History for a user
 * Supports pagination similar to your getLeads method
 */
export const getMyAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);

    const { records, total } = await AttendanceService.getAttendanceHistory(
      userId!.toString(),
      page,
      limit
    );

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: 'Attendance records retrieved successfully',
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get attendance history error:', error);
    sendError(res, error, 500);
  }
};

/**
 * Get Monthly Report for Salary Slip
 * Aggregates total hours worked in a month
 */
export const getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query; // e.g., ?month=02&year=2026
    const userId = req.user?.userId;

    if (!month || !year) {
      res.status(400).json({ success: false, message: 'Month and Year are required' });
      return;
    }

    const stats = await AttendanceService.calculateMonthlyStats(
      userId!.toString(),
      Number(month),
      Number(year)
    );

    res.status(200).json({
      success: true,
      message: 'Monthly attendance stats retrieved',
      data: stats
    });
  } catch (error) {
    sendError(res, error, 500);
  }
};

export const getWorkHours = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      // Get period from query, default to 'today'
      const period = (req.query.period as 'today' | 'monthly' | 'yearly') || 'today';
  
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
  
      const stats = await AttendanceService.getWorkHoursStats(userId.toString(), period);
  
      res.status(200).json({
        success: true,
        message: `Work hours for ${period} retrieved`,
        data: {
          period,
          totalHours: stats.totalHours,
          daysCount: stats.count
        }
      });
    } catch (error) {
      sendError(res, error, 500);
    }
  };



  export const getAdminReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const from = req.query.from as string;
        const to = req.query.to as string;
        const period = req.query.period as string;
        
        // Ensure numbers are handled correctly
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, parseInt(req.query.limit as string) || 10);

        const result = await AttendanceService.generateAdminReport(from, to, page, limit, period);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error: any) {
        sendError(res, error, 500);
    }
};


export const getEmployeeAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { from, to, month, year, page = 1, limit = 10 } = req.query;

    const result = await AttendanceService.getUserAnalytics(userId, {
      from: from as string,
      to: to as string,
      month: month as string,
      year: year as string,
      page: Number(page),
      limit: Number(limit)
    });

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    sendError(res, error, 500);
  }
};



/**
 * GET /api/attendance/report
 * Returns today's summary and detailed attendance logs
 */
export const getAttendanceReport = async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate, page, limit } = req.query;

    // 1. Default filters and pagination
    const today = new Date().toISOString().split('T')[0];
    const start = fromDate ? String(fromDate) : today;
    const end = toDate ? String(toDate) : today;
    
    const pageNum = parseInt(String(page)) || 1;
    const limitNum = parseInt(String(limit)) || 10;

    // 2. Call service with pagination parameters
    const report = await getAttendanceReportService(start, end, pageNum, limitNum);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      filters: { start, end },
      pagination: report.pagination, // Return metadata for the frontend
      data: {
        summary: report.summary,
        details: report.details
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to generate attendance report",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal Server Error"
    });
  }
};
//   export const getAttendanceStatus = async (req: Request, res: Response) => {
//     try {
//       const userId = req.user?.userId;
//       // Use the YYYY-MM-DD string format to match your Service logic
//       const todayStr = new Date().toISOString().split('T')[0];
  
//       // Look for a record today where checkOut is strictly NULL
//       const activeSession = await Attendance.findOne({
//         user: userId,
//         date: todayStr,
//         checkOut: null // Matches the updated Model default
//       });
  
//       res.status(200).json({
//         success: true,
//         data: {
//           isClockedIn: !!activeSession, 
//           checkInTime: activeSession ? activeSession.checkIn : null
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ success: false, message: "Error checking status" });
//     }
//   };


import moment from 'moment';
import { getUserFullPerformance } from '../service/performance.service';

export const getUserAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { range, from, to } = req.query;

    // Default: Current Month
    let startDate = moment().startOf('month').toDate();
    let endDate = moment().endOf('day').toDate();

    if (range === 'week') {
      startDate = moment().startOf('week').toDate();
    } else if (range === 'year') {
      startDate = moment().startOf('year').toDate();
    } else if (from && to) {
      startDate = moment(String(from)).startOf('day').toDate();
      endDate = moment(String(to)).endOf('day').toDate();
    }

    const data = await getUserFullPerformance(userId, { startDate, endDate });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating user analytics'
    });
  }
};