import { Request, Response } from 'express';
import { sendError } from '../utils/sendError';
import { fetchPerformanceTrend, fetchTeamPerformance } from '../service/performance.service';

export const getTeamPerformanceDashboard = async (req: Request, res: Response) => {
  try {
    const performanceData = await fetchTeamPerformance(req.query);
    
    // ADDED 'return' HERE
    return res.status(200).json({
      success: true,
      message: 'Team performance data generated successfully',
      data: performanceData
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getUserPerformanceDashboard = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const [trend, teamStats] = await Promise.all([
      fetchPerformanceTrend(req.query, userId),
      fetchTeamPerformance({ ...req.query })
    ]);

    const userStats = teamStats.find((s: any) => s.userId.toString() === userId);

    // ADDED 'return' HERE
    return res.status(200).json({
      success: true,
      data: {
        overview: userStats || { totalLeads: 0, closedSales: 0, conversionRate: 0 },
        graphData: trend
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
};