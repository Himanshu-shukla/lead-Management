import mongoose from 'mongoose';
import { Attendance, IAttendance } from '../models/attendance.model';
import User from '../models/User';

// Configuration - Move these to your .env or a Settings model later
const COMPANY_LOCATION = {
  lat: 28.601220960871636, // Replace with your company latitude
  lng: 77.43365336008797 // Replace with your company longitude
};
const ALLOWED_RADIUS_METERS = 200; 

export const AttendanceService = {
  /**
   * Calculate distance between two points using Haversine Formula
   */
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Process Clock-In with Geofencing
   */
/**
   * Process Clock-In with Geofencing and Null Initialization
   */
// src/service/attendance.service.ts

  /**
   * Process Clock-In with Geofencing Bypass for WFH
   */
  clockIn: async (userId: string, lat: number, lng: number): Promise<IAttendance> => {
    // 1. Fetch the user's specific permissions
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // 2. Check Geofencing: Only calculate distance if WFH is NOT allowed
    if (!user.canWorkFromHome) {
      const distance = AttendanceService.calculateDistance(
        lat, lng, 
        COMPANY_LOCATION.lat, COMPANY_LOCATION.lng
      );

      // Enforce the ALLOWED_RADIUS_METERS (200m) limit
      if (distance > ALLOWED_RADIUS_METERS) {
        throw new Error(`Location restricted. You are ${Math.round(distance)}m away from the office.`);
      }
    } else {
      console.log(`Bypassing geofence for user: ${user.name} (WFH Active)`);
    }

    // 3. Prevent double Clock-In for the same day
    const today = new Date().toISOString().split('T')[0];
    const existingActive = await Attendance.findOne({ 
      user: userId, 
      date: today, 
      checkOut: null 
    });
    
    if (existingActive) {
      throw new Error('You are already clocked in.');
    }

    // 4. Create the attendance record
    const attendance = new Attendance({
      user: new mongoose.Types.ObjectId(userId),
      date: today,
      checkIn: new Date(),
      checkOut: null, // Critical for requireClockIn middleware
      location: { lat, lng },
      status: 'Present'
    });

    return await attendance.save();
  },

  /**
   * Process Clock-Out and Finalize Hours
   * /**
   * Process Clock-Out with Geofencing and WFH Bypass
   */
  clockOut: async (userId: string, lat: number, lng: number): Promise<IAttendance> => {
    // 1. Fetch user to check WFH permissions
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // 2. Geofencing check: Only enforce if WFH is NOT allowed
    if (!user.canWorkFromHome) {
      // Use your existing calculateDistance logic
      const distance = AttendanceService.calculateDistance(
        lat, lng, 
        COMPANY_LOCATION.lat, COMPANY_LOCATION.lng
      );

      // Enforce the 200m office radius
      if (distance > ALLOWED_RADIUS_METERS) {
        throw new Error(`Location restricted. You must be at the office to clock out. You are ${Math.round(distance)}m away.`);
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // 3. Find the active session for today (where checkOut is null)
    const record = await Attendance.findOne({ 
      user: userId, 
      date: today, 
      checkOut: null 
    });

    if (!record) {
      throw new Error('No active clock-in session found for today.');
    }

    // 4. Update the record with current time
    record.checkOut = new Date();
    
    // 5. Calculate total hours worked
    const diffInMs = record.checkOut.getTime() - record.checkIn.getTime();
    const hours = diffInMs / (1000 * 60 * 60);
    record.workHours = parseFloat(hours.toFixed(2));

    return await record.save();
  },



  /**
   * Get Paginated History
   */
  getAttendanceHistory: async (userId: string, page: number, limit: number) => {
    const skip = (page - 1) * limit;
    
    const [records, total] = await Promise.all([
      Attendance.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Attendance.countDocuments({ user: userId })
    ]);

    return { records, total };
  },

  /**
   * Aggregate Data for Salary Slip
   */
  calculateMonthlyStats: async (userId: string, month: number, year: number) => {
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-31`;

    const stats = await Attendance.aggregate([
      { 
        $match: { 
          user: new mongoose.Types.ObjectId(userId),
          date: { $gte: startOfMonth, $lte: endOfMonth }
        } 
      },
      {
        $group: {
          _id: "$user",
          totalDays: { $sum: 1 },
          totalHours: { $sum: "$workHours" },
          averageHours: { $avg: "$workHours" }
        }
      }
    ]);

    return stats[0] || { totalDays: 0, totalHours: 0, averageHours: 0 };
  },

  getWorkHoursStats: async (userId: string, period: 'today' | 'monthly' | 'yearly') => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    let startDate: Date;

    // Define the time range using native JS Dates
    if (period === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Start of today
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
    } else {
      startDate = new Date(now.getFullYear(), 0, 1); // 1st of current year
    }

    const stats = await Attendance.aggregate([
      {
        $match: {
          user: userObjectId,
          // Match records where checkIn is between startDate and now
          checkIn: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: "$workHours" },
          count: { $sum: 1 } // Number of days worked in this period
        }
      }
    ]);

    // Return the aggregated data or default zeros if no records found
    return stats[0] || { totalHours: 0, count: 0 };
  },
  generateAdminReport: async (from: string, to: string, page: number, limit: number, period?: string) => {
    const todayStr = new Date().toISOString().split('T')[0]; 
    let query: any = {};

    if (period === 'today') {
        query.date = todayStr;
    } else if (from && to) {
        query.date = { $gte: String(from).trim(), $lte: String(to).trim() };
    }

    // Fetch all users to calculate "Absent" status correctly
    const allUsers = await User.find({ role: { $ne: 'superAdmin' } }).select('name email').lean();
    const records = await Attendance.find(query)
        .populate('user', 'name email')
        .sort({ date: -1, checkIn: 1 })
        .lean();

    const dateGroups: any = {};
    const userStats: Map<string, { total: number, auto: number }> = new Map();

    // Stats for the "summary" object
    let presentRightNow = 0;
    let lateTodayCount = 0;
    const presentTodaySet = new Set();

    records.forEach((r: any) => {
        const uId = r.user?._id?.toString() || 'unknown';
        const uName = r.user?.name || 'Unknown User';
        const rDate = r.date;
        
        let co = r.checkOut;
        let wh = Number(r.workHours) || 0;
        let isAutoLogout = false;

        // --- 🚀 AUTO-LOGOUT LOGIC ---
        if (!co && rDate < todayStr) {
            wh = 8.0; 
            co = "Auto-Closed (8h)";
            isAutoLogout = true;
        }

        // Stats tracking
        if (rDate === todayStr) {
            presentTodaySet.add(uId);
            if (!r.checkOut) presentRightNow++;
            if (r.isLate) lateTodayCount++;
        }

        // --- 1. GROUP BY DATE ---
        if (!dateGroups[rDate]) dateGroups[rDate] = {};
        if (!dateGroups[rDate][uId]) {
            dateGroups[rDate][uId] = {
                userId: uId,
                userName: uName,
                userEmail: r.user?.email || 'N/A',
                date: rDate,
                status: "Present", // Default to Present if a record exists
                totalWorkHours: 0,
                lastCheckOut: co || "Active",
                minutesLate: r.minutesLate || 0,
                isLate: r.isLate || false,
                sessions: []
            };
        }

        const userDay = dateGroups[rDate][uId];
        userDay.totalWorkHours = Number((userDay.totalWorkHours + wh).toFixed(2));
        userDay.lastCheckOut = co || "Active";
        userDay.sessions.push({
            checkIn: r.checkIn,
            checkOut: co || "Active",
            hours: wh,
            isAutoClosed: isAutoLogout,
            isLate: r.isLate || false
        });

        // --- 2. SUM TO GRAND TOTALS ---
        const stats = userStats.get(uId) || { total: 0, auto: 0 };
        stats.total = Number((stats.total + wh).toFixed(2));
        if (isAutoLogout) stats.auto = Number((stats.auto + 8.0).toFixed(2));
        userStats.set(uId, stats);
    });

    // --- 3. INJECT ABSENT USERS FOR EACH DATE ---
    // Only applies if looking at historical data
    Object.keys(dateGroups).forEach(date => {
        allUsers.forEach(user => {
            const userId = user._id.toString();
            if (!dateGroups[date][userId]) {
                dateGroups[date][userId] = {
                    userId: userId,
                    userName: user.name,
                    userEmail: user.email,
                    date: date,
                    status: "Absent",
                    totalWorkHours: 0,
                    lastCheckOut: null,
                    minutesLate: 0,
                    isLate: false,
                    sessions: []
                };
            }
        });
    });

    // --- PAGINATION ON DATES ---
    const allSortedDates = Object.keys(dateGroups).sort().reverse();
    const startIndex = (page - 1) * limit;
    const paginatedDates = allSortedDates.slice(startIndex, startIndex + limit);

    const paginatedReport: any = {};
    paginatedDates.forEach(date => {
        paginatedReport[date] = Object.values(dateGroups[date]);
    });

    const userGrandSummary = Array.from(userStats.keys()).map(id => {
        const sample = records.find(rec => (rec.user?._id?.toString() || rec.user?.toString()) === id);
        const stats = userStats.get(id);
        const userObj = sample?.user as any; 
        return {
            userName: userObj?.name || 'Unknown',
            totalHoursInRange: stats?.total || 0,
            autoLogoutHours: stats?.auto || 0
        };
    }).sort((a, b) => b.totalHoursInRange - a.totalHoursInRange);

    return {
        summary: {
            totalEmployees: allUsers.length,
            presentRightNow: presentRightNow,
            presentToday: presentTodaySet.size,
            lateToday: lateTodayCount,
            absentToday: allUsers.length - presentTodaySet.size
        },
        report: paginatedReport,
        userGrandTotals: userGrandSummary,
        pagination: {
            totalDates: allSortedDates.length,
            currentPage: page,
            limit: limit,
            totalPages: Math.ceil(allSortedDates.length / limit)
        }
    };
},

  getUserAnalytics: async (userId: string, filters: { from?: string, to?: string, month?: string, year?: string, page: number, limit: number }) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    let query: any = { user: new mongoose.Types.ObjectId(userId) };

    // 1. Build Query based on Filters
    if (filters.month && filters.year) {
      // Matches "2025-01"
      const monthPattern = `${filters.year}-${filters.month.padStart(2, '0')}`;
      query.date = { $regex: new RegExp(`^${monthPattern}`) };
    } else if (filters.year) {
      // Matches "2025"
      query.date = { $regex: new RegExp(`^${filters.year}`) };
    } else if (filters.from && filters.to) {
      query.date = { $gte: filters.from, $lte: filters.to };
    }

    // 2. Fetch Data
    const records = await Attendance.find(query).sort({ date: -1, checkIn: 1 }).lean();

    let totalWorkingHours = 0;
    let autoLogoutHours = 0;
    const presentDatesSet = new Set<string>();

    // 3. Process Analytics
    const dailyLogs = records.reduce((acc: any, r: any) => {
      const rDate = r.date;
      let wh = Number(r.workHours) || 0;
      let co = r.checkOut;
      let isAuto = false;

      if (!co && rDate < todayStr) {
        wh = 8.0;
        co = "Auto-Closed (8h)";
        isAuto = true;
        autoLogoutHours += 8.0;
      }

      totalWorkingHours += wh;
      presentDatesSet.add(rDate);

      if (!acc[rDate]) {
        acc[rDate] = { date: rDate, dayTotal: 0, sessions: [] };
      }

      acc[rDate].dayTotal = Number((acc[rDate].dayTotal + wh).toFixed(2));
      acc[rDate].sessions.push({
        checkIn: r.checkIn,
        checkOut: co || "Active",
        hours: wh,
        isAutoClosed: isAuto
      });

      return acc;
    }, {});

    // 4. Calculate Days
    const totalPresent = presentDatesSet.size;
    
    // logic to estimate days in range/month for "Not Present"
    let daysInPeriod = 30; // Default fallback
    if (filters.month && filters.year) {
        daysInPeriod = new Date(Number(filters.year), Number(filters.month), 0).getDate();
    }

    const reportArray = Object.values(dailyLogs);
    const startIndex = (filters.page - 1) * filters.limit;
    const paginatedLogs = reportArray.slice(startIndex, startIndex + filters.limit);

    return {
      stats: {
        totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
        autoLogoutHours: Number(autoLogoutHours.toFixed(2)),
        totalDaysPresent: totalPresent,
        totalDaysNotPresent: Math.max(0, daysInPeriod - totalPresent),
      },
      attendanceHistory: paginatedLogs,
      pagination: {
        totalDaysLogged: reportArray.length,
        currentPage: filters.page,
        totalPages: Math.ceil(reportArray.length / filters.limit)
      }
    };
  }
};



// attendance.service.ts

import moment from 'moment';

export const getAttendanceReportService = async (
  fromDate: string, 
  toDate: string, 
  page: number, 
  limit: number
) => {
  const OFFICE_START_TIME = process.env.OFFICE_START_TIME || "09:00";
  
  // 1. Get total count for pagination metadata
  const totalEmployees = await User.countDocuments({ isActive: true });
  
  // 2. Fetch paginated users
  const users = await User.find({ isActive: true })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('name email _id');

  // 3. Fetch all logs for the date range for these specific users
  const userIds = users.map(u => u._id);
  const logs = await Attendance.find({
    user: { $in: userIds },
    date: { $gte: fromDate, $lte: toDate }
  });

  // 4. Determine Global Summary (Requires a separate check for all users)
  // To keep the HUD stats accurate, we count statuses across the whole range
  const allLogsToday = await Attendance.find({ date: new Date().toISOString().split('T')[0] });

  const details = users.map(user => {
    const userLogs = logs.filter(l => l.user.toString() === user.id.toString());
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = userLogs.find(l => l.date === todayStr);
    
    let minutesLate = 0;
    if (todayLog && todayLog.checkIn) {
      const checkInMoment = moment(todayLog.checkIn);
      const expectedTime = moment(todayLog.checkIn).set({
        hour: parseInt(OFFICE_START_TIME.split(':')[0]),
        minute: parseInt(OFFICE_START_TIME.split(':')[1]),
        second: 0
      });
      
      if (checkInMoment.isAfter(expectedTime)) {
        minutesLate = checkInMoment.diff(expectedTime, 'minutes');
      }
    }

    return {
      userId: user._id,
      name: user.name,
      status: todayLog ? todayLog.status : "Absent",
      checkIn: todayLog?.checkIn || null,
      checkOut: todayLog?.checkOut || null,
      minutesLate: minutesLate > 0 ? minutesLate : 0,
      isLate: minutesLate > 0,
      isPresentNow: todayLog && todayLog.checkOut === null 
    };
  });

  return {
    pagination: {
      totalEmployees,
      currentPage: page,
      totalPages: Math.ceil(totalEmployees / limit),
      hasNextPage: page * limit < totalEmployees
    },
    summary: {
      totalEmployees,
      presentRightNow: allLogsToday.filter(l => l.checkOut === null).length,
      presentToday: allLogsToday.length,
      lateToday: details.filter(d => d.isLate).length, // Note: This is now page-specific
      absentToday: totalEmployees - allLogsToday.length
    },
    details
  };
};