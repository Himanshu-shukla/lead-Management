import mongoose from 'mongoose';
import Lead from '../models/Lead';

// Helper to calculate date ranges based on user selection
export const getCriteriaDateRange = (query: any) => {
  const { year, month, week, startDate, endDate } = query;
  const now = new Date();
  let start = new Date(now.getFullYear(), 0, 1);
  let end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  if (startDate && endDate) {
    return { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  if (year) {
    const y = parseInt(year);
    if (month) {
      const m = parseInt(month) - 1; // JS months are 0-11
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
    } else {
      start = new Date(y, 0, 1);
      end = new Date(y, 12, 0, 23, 59, 59);
    }
  }

  // Logic for specific week of the current year
  if (week) {
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const days = (parseInt(week) - 1) * 7;
    start = new Date(firstDayOfYear.setDate(firstDayOfYear.getDate() + days));
    end = new Date(new Date(start).setDate(start.getDate() + 6));
  }

  return { $gte: start, $lte: end };
};

// Function to get activity/performance across the whole team
export const fetchTeamPerformance = async (filters: any) => {
  const dateRange = getCriteriaDateRange(filters);

  return await Lead.aggregate([
    { $match: { createdAt: dateRange } },
    {
      $group: {
        _id: '$assignedTo',
        totalLeads: { $sum: 1 },
        closedSales: { $sum: { $cond: [{ $eq: ['$status', 'Sales Done'] }, 1, 0] } },
        qualifiedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Qualified'] }, 1, 0] } },
        revenuePotential: { $sum: '$leadScore' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: '$user.name',
        totalLeads: 1,
        closedSales: 1,
        conversionRate: {
          $cond: [{ $gt: ['$totalLeads', 0] }, { $multiply: [{ $divide: ['$closedSales', '$totalLeads'] }, 100] }, 0]
        },
        efficiencyScore: { $divide: ['$revenuePotential', '$totalLeads'] }
      }
    },
    { $sort: { closedSales: -1 } }
  ]);
};

// Function to get trend data for graphs
export const fetchPerformanceTrend = async (filters: any, userId?: string) => {
  const dateRange = getCriteriaDateRange(filters);
  const match: any = { createdAt: dateRange };
  
  if (userId) match.assignedTo = new mongoose.Types.ObjectId(userId);

  return await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        count: { $sum: 1 },
        won: { $sum: { $cond: [{ $eq: ['$status', 'Sales Done'] }, 1, 0] } }
      }
    },
    { $sort: { "_id": 1 } }
  ]);
};


// src/services/userPerformance.service.ts

import moment from 'moment';
import User from '../models/User';
import { Attendance } from '../models/attendance.model';

// src/services/userPerformance.service.ts

export const getUserFullPerformance = async (userId: string, filters: any) => {
  const { startDate, endDate } = filters;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Fetch User Details
  const user = await User.findById(userId).select('-password');
  if (!user) throw new Error('User not found');

  // 2. Lead Analytics - Aggregation
  // We match leads currently assigned to this user
  const leadStats = await Lead.aggregate([
    { 
      $match: { 
        assignedTo: userObjectId 
        // Note: Removed strict createdAt filter to catch all active leads
      } 
    },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byFolder: [{ $group: { _id: "$folder", count: { $sum: 1 } } }],
        totalAssigned: [{ $count: "count" }],
        closedLeads: [
          // Match your exact status name: 'Sales Done'
          { $match: { status: "Sales Done" } }, 
          { $count: "count" }
        ]
      }
    }
  ]);

  // 3. Attendance Analytics
  const attendanceLogs = await Attendance.find({
    user: userObjectId,
    date: { 
      $gte: moment(startDate).format('YYYY-MM-DD'), 
      $lte: moment(endDate).format('YYYY-MM-DD') 
    }
  }).sort({ date: 1 });

  const OFFICE_START = process.env.OFFICE_START_TIME || "09:00";
  
  const attendanceMetrics = attendanceLogs.reduce((acc, log) => {
    acc.presentDays += 1;
    
    // Calculate Lateness: Compare checkIn ISO string to Office Start
    const checkInTime = moment(log.checkIn).format("HH:mm");
    if (checkInTime > OFFICE_START) acc.lateDays += 1;

    // Detect Auto-Logout: checkOut is null and it's not today
    if (!log.checkOut && log.date !== moment().format('YYYY-MM-DD')) {
      acc.autoLogouts += 1;
    }

    // Calculate dynamic working hours for current session if checkOut is missing
    let hours = log.workHours || 0;
    if (!log.checkOut && log.date === moment().format('YYYY-MM-DD')) {
      const now = moment();
      const start = moment(log.checkIn);
      hours = now.diff(start, 'hours', true); 
    }
    acc.totalWorkingHours += hours;

    return acc;
  }, { totalWorkingHours: 0, presentDays: 0, lateDays: 0, autoLogouts: 0 });

  // 4. Extract Facet Results
  const total = leadStats[0].totalAssigned[0]?.count || 0;
  const closed = leadStats[0].closedLeads[0]?.count || 0;
  const conversionRate = total > 0 ? ((closed / total) * 100).toFixed(2) : "0.00";

  return {
    userDetails: {
      name: user.name,
      email: user.email,
      role: user.role,
      joinedAt: user.createdAt,
    },
    leadPerformance: {
      totalAssigned: total,
      totalClosed: closed,
      conversionRate: `${conversionRate}%`,
      folders: leadStats[0].byFolder.map((f: any) => ({ 
        folderName: f._id || 'Uncategorized', 
        count: f.count 
      })),
      statuses: leadStats[0].byStatus.map((s: any) => ({ 
        status: s._id, 
        count: s.count 
      }))
    },
    attendanceReport: {
      presentDays: attendanceMetrics.presentDays,
      lateDays: attendanceMetrics.lateDays,
      autoLogouts: attendanceMetrics.autoLogouts,
      totalWorkingHours: attendanceMetrics.totalWorkingHours.toFixed(2),
      logs: attendanceLogs.map(l => ({
        date: l.date,
        checkIn: l.checkIn,
        checkOut: l.checkOut,
        status: l.status,
        // If still clocked in, show 'Live' instead of 0
        hours: l.checkOut ? l.workHours.toFixed(2) : "Live Session"
      }))
    }
  };
};