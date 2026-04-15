import { Request, Response } from 'express';
import * as PayrollService from '../service/payroll.service';
import { sendError } from '../utils/sendError';

/**
 * Users can view their own slip; Admin can view anyone's slip.
 */
export const getSalarySlipData = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    // RBAC Check: Ensure user is admin OR requesting their own slip
    if (req.user?.role !== 'admin' && req.user?.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own salary slip.'
      });
    }

    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: "Month and Year are required query parameters" 
      });
    }

    const report = await PayrollService.calculateMonthlyPayroll(
      userId, 
      Number(month), 
      Number(year)
    );

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * RBAC: Only Admin can see company-wide summary.
 */


export const getCompanyPayrollSummary = async (req: Request, res: Response) => {
  try {
    // 1. RBAC: Strict Admin Check
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can view company-wide payroll.'
      });
    }

    const { month, year } = req.query;

    // 2. Validation
    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide both month and year." 
      });
    }

    // 3. Service Call
    const summary = await PayrollService.getCompanyPayrollSummary(
      Number(month), 
      Number(year)
    );

    // 4. Success Response
    return res.status(200).json({
      success: true,
      message: `Payroll summary for ${summary.summary.month} ${year} retrieved successfully`,
      data: summary
    });

  } catch (error: any) {
    // 5. High-Level Error Handling
    console.error('Payroll Summary Error:', error);
    return sendError(res, error, 500);
  }
};