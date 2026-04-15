// services/salary.service.ts
import { Salary, LeavePolicy, EmployeeLeaveBalance, HolidayPolicy } from '../models/leaveAndPay';
import { EmployeeDocument } from '../models/EmployeeDocument.model';
import User from '../models/User';
import mongoose from 'mongoose';

// Error classes
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

// Types
export interface CTCBreakup {
  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  special: number;
  bonus: number;
  gratuity: number;
  pf: number;
  insurance: number;
  otherAllowances?: { name: string; amount: number }[];
}

export interface SalaryData {
  ctc: {
    annual: number;
    breakup: CTCBreakup;
  };
  effectiveDate?: Date;
  reason?: string;
}

// Helper function to calculate in-hand from CTC
const calculateInHandFromCTC = (_ctc: number, breakup: CTCBreakup) => {
  // Standard Indian salary calculations
  const monthlyBasic = breakup.basic / 12;
  const monthlyHRA = breakup.hra / 12;
  const monthlyConveyance = breakup.conveyance / 12;
  const monthlyMedical = breakup.medical / 12;
  const monthlySpecial = breakup.special / 12;
  const monthlyBonus = breakup.bonus / 12;

  // Calculate monthly in-hand (simplified)
  const monthlyInHand = monthlyBasic + monthlyHRA + monthlyConveyance + 
                       monthlyMedical + monthlySpecial + monthlyBonus;

  // Calculate deductions (simplified)
  const pfDeduction = Math.min(1800, monthlyBasic * 0.12); // PF capped at 1800
  const professionalTax = 200; // Standard PT
  const insuranceDeduction = breakup.insurance / 12;

  // Annual in-hand after deductions (before income tax)
  const annualAfterDeductions = (monthlyInHand - pfDeduction - professionalTax - insuranceDeduction) * 12;

  return {
    monthly: Number((monthlyInHand - pfDeduction - professionalTax - insuranceDeduction).toFixed(2)),
    annual: Number((annualAfterDeductions * 0.9).toFixed(2)), // Approx 10% tax
    breakup: {
      basic: monthlyBasic,
      hra: monthlyHRA,
      conveyance: monthlyConveyance,
      medical: monthlyMedical,
      special: monthlySpecial,
      bonus: monthlyBonus
    }
  };
};

export const SalaryService = {
  /**
   * Set or update employee salary
   */
  setSalary: async (userId: string, salaryData: SalaryData, adminId: string) => {
    try {
      if (!userId || !salaryData.ctc || !salaryData.ctc.breakup) {
        throw new ValidationError('User ID and salary data are required');
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Get employee document for employeeId
      const employeeDoc = await EmployeeDocument.findOne({ user: userId });
      if (!employeeDoc) {
        throw new NotFoundError('Employee record not found. Please complete onboarding first.');
      }

      // Calculate in-hand from CTC
      const inHand = calculateInHandFromCTC(
        salaryData.ctc.annual, 
        salaryData.ctc.breakup
      );

      // Calculate deductions
      const deductions = {
        pf: Math.min(1800 * 12, salaryData.ctc.breakup.basic * 0.12), // Annual PF
        professionalTax: 200 * 12, // Annual PT
        incomeTax: salaryData.ctc.annual * 0.1, // Approx 10% tax
        insurance: salaryData.ctc.breakup.insurance,
        otherDeductions: []
      };

      // Find existing salary
      const existingSalary = await Salary.findOne({ user: userId });

      if (existingSalary) {
        // Create revision history entry
        const revisionEntry = {
          oldCTC: existingSalary.ctc.annual,
          newCTC: salaryData.ctc.annual,
          effectiveDate: salaryData.effectiveDate || new Date(),
          reason: salaryData.reason || 'Salary revision',
          updatedBy: new mongoose.Types.ObjectId(adminId),
          updatedAt: new Date()
        };

        // Update existing salary
        existingSalary.ctc = salaryData.ctc;
        existingSalary.inHand = inHand;
        existingSalary.deductions = deductions;
        existingSalary.effectiveDate = salaryData.effectiveDate || new Date();
        existingSalary.updatedBy = new mongoose.Types.ObjectId(adminId);
        existingSalary.revisionHistory.push(revisionEntry);
        
        await existingSalary.save();

        return {
          success: true,
          message: 'Salary updated successfully',
          data: existingSalary
        };
      } else {
        // Create new salary record
        const newSalary = new Salary({
          user: new mongoose.Types.ObjectId(userId),
          employeeId: employeeDoc.employmentDetails.employeeId,
          ctc: salaryData.ctc,
          inHand: inHand,
          deductions: deductions,
          effectiveDate: salaryData.effectiveDate || new Date(),
          updatedBy: new mongoose.Types.ObjectId(adminId),
          revisionHistory: []
        });

        await newSalary.save();

        return {
          success: true,
          message: 'Salary set successfully',
          data: newSalary
        };
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get employee salary by user ID
   */
  getSalaryByUserId: async (userId: string, requesterId: string, isAdmin: boolean) => {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      // Check authorization
      if (!isAdmin && requesterId !== userId) {
        throw new UnauthorizedError('You can only view your own salary details');
      }

      const salary = await Salary.findOne({ user: userId, isActive: true })
        .populate('user', 'name email')
        .populate('updatedBy', 'name');

      if (!salary) {
        throw new NotFoundError('Salary details not found for this employee');
      }

      // Get tax breakup
      const taxBreakup = salary.getTaxBreakup();

      return {
        success: true,
        data: {
          ...salary.toObject(),
          taxBreakup
        }
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all salaries (Admin only)
   */
  getAllSalaries: async (filters?: { department?: string; isActive?: boolean }) => {
    try {
      const query: any = { isActive: true };
      
      if (filters?.department) {
        // Get employees from that department first
        const employees = await EmployeeDocument.find({ 
          'employmentDetails.department': filters.department 
        }).select('user');
        
        const userIds = employees.map(emp => emp.user);
        query.user = { $in: userIds };
      }

      if (filters?.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      const salaries = await Salary.find(query)
        .populate('user', 'name email')
        .populate('updatedBy', 'name')
        .sort({ 'employmentDetails.employeeId': 1 });

      // Calculate summary statistics
      const summary = {
        totalEmployees: salaries.length,
        totalCTCBurden: salaries.reduce((sum, s) => sum + s.ctc.annual, 0),
        averageCTC: salaries.length > 0 
          ? salaries.reduce((sum, s) => sum + s.ctc.annual, 0) / salaries.length 
          : 0,
        averageInHand: salaries.length > 0 
          ? salaries.reduce((sum, s) => sum + s.inHand.annual, 0) / salaries.length 
          : 0
      };

      return {
        success: true,
        summary,
        data: salaries
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get salary revision history
   */
  getSalaryHistory: async (userId: string) => {
    try {
      const salary = await Salary.findOne({ user: userId })
        .populate('revisionHistory.updatedBy', 'name');

      if (!salary) {
        throw new NotFoundError('Salary details not found');
      }

      return {
        success: true,
        data: salary.revisionHistory.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Initialize leave policies (Run once during setup)
   */
  initializeLeavePolicies: async () => {
    try {
      const defaultPolicies = [
        {
          title: 'Sick Leave',
          description: 'Leave for medical reasons',
          leaveType: 'Sick',
          daysPerYear: 12,
          isCarryForward: true,
          maxCarryForward: 6,
          isEncashable: false,
          applicableTo: ['full-time', 'part-time', 'contract', 'probation'],
          proRated: true
        },
        {
          title: 'Casual Leave',
          description: 'Leave for personal reasons',
          leaveType: 'Casual',
          daysPerYear: 10,
          isCarryForward: false,
          isEncashable: true,
          applicableTo: ['full-time', 'part-time', 'contract', 'probation'],
          proRated: true
        },
        {
          title: 'Paid Leave',
          description: 'Earned/Privilege leave',
          leaveType: 'Paid',
          daysPerYear: 18,
          isCarryForward: true,
          maxCarryForward: 30,
          isEncashable: true,
          applicableTo: ['full-time', 'part-time', 'contract'],
          proRated: true
        },
        {
          title: 'Maternity Leave',
          description: 'Leave for new mothers',
          leaveType: 'Maternity',
          gender: 'Female',
          daysPerYear: 180,
          isCarryForward: false,
          isEncashable: false,
          applicableTo: ['full-time', 'part-time', 'contract'],
          minServiceDays: 180,
          proRated: false
        },
        {
          title: 'Paternity Leave',
          description: 'Leave for new fathers',
          leaveType: 'Paternity',
          gender: 'Male',
          daysPerYear: 15,
          isCarryForward: false,
          isEncashable: false,
          applicableTo: ['full-time', 'part-time', 'contract'],
          minServiceDays: 180,
          proRated: false
        }
      ];

      for (const policy of defaultPolicies) {
        await LeavePolicy.findOneAndUpdate(
          { leaveType: policy.leaveType },
          policy,
          { upsert: true, new: true }
        );
      }

      return {
        success: true,
        message: 'Leave policies initialized successfully'
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all leave policies
   */
  getLeavePolicies: async () => {
    try {
      const policies = await LeavePolicy.find().sort({ leaveType: 1 });
      return {
        success: true,
        data: policies
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Initialize/update employee leave balance for a year
   */
  initializeLeaveBalance: async (userId: string, year: number) => {
    try {
      // Get employee details
      const employeeDoc = await EmployeeDocument.findOne({ user: userId });
      if (!employeeDoc) {
        throw new NotFoundError('Employee record not found');
      }

      // Get all leave policies
      const policies = await LeavePolicy.find({
        applicableTo: { $in: [employeeDoc.employmentDetails.employmentType] }
      });

      // Calculate prorated leave if joining mid-year
      const joiningDate = employeeDoc.employmentDetails.joiningDate;
      let prorationFactor = 1;
      
      if (new Date(joiningDate).getFullYear() === year) {
        const monthsWorked = 12 - new Date(joiningDate).getMonth();
        prorationFactor = monthsWorked / 12;
      }

      // Prepare balances
      const balances = policies.map(policy => {
        const allocated = policy.proRated 
          ? Math.round(policy.daysPerYear * prorationFactor) 
          : policy.daysPerYear;

        return {
          leaveType: policy.leaveType,
          allocated,
          used: 0,
          pending: 0,
          remaining: allocated,
          carriedForward: 0
        };
      });

      // Find or create balance record
      const balance = await EmployeeLeaveBalance.findOneAndUpdate(
        { user: userId, year },
        {
          user: new mongoose.Types.ObjectId(userId),
          employeeId: employeeDoc.employmentDetails.employeeId,
          year,
          balances,
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Leave balance initialized successfully',
        data: balance
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get employee leave balance
   */
  getLeaveBalance: async (userId: string, year?: number) => {
    try {
      const targetYear = year || new Date().getFullYear();
      
      let balance = await EmployeeLeaveBalance.findOne({ 
        user: userId, 
        year: targetYear 
      });

      // If not found, initialize it
      if (!balance) {
        // FIX: Destructure 'data' from the service response
        const response = await SalaryService.initializeLeaveBalance(userId, targetYear);
        balance = response.data; 
      }

      return {
        success: true,
        data: balance
      };
    } catch (error) {
      throw error;
    }
},
  /**
   * Update leave balance after leave approval
   */
// Update the signature to accept the 4th argument: session
// services/salary.service.ts - Add this method
updateLeaveBalanceAfterApproval: async (userId: any, leaveType: string, days: number, session?: mongoose.ClientSession) => {
  try {

    console.log("su=====>",userId)
    const currentYear = new Date().getFullYear();
    
    // Use provided session or create new one
    const options = session ? { session } : {};
    
    // Find or create leave balance for current year
    let balance = await EmployeeLeaveBalance.findOne({ 
      user: userId, 
      year: currentYear 
    }).session(session || null);

    // If no balance exists, initialize it
    if (!balance) {
      // Get employee details
      const employeeDoc = await EmployeeDocument.findOne({ user: userId });
      if (!employeeDoc) {
        throw new ValidationError('Employee record not found');
      }

      // Get leave policies
      const policies = await LeavePolicy.find({
        applicableTo: { $in: [employeeDoc.employmentDetails.employmentType] }
      });

      // Calculate prorated leave
      const joiningDate = employeeDoc.employmentDetails.joiningDate;
      let prorationFactor = 1;
      
      if (new Date(joiningDate).getFullYear() === currentYear) {
        const monthsWorked = 12 - new Date(joiningDate).getMonth();
        prorationFactor = monthsWorked / 12;
      }

      // Create balances
      const balances = policies.map(policy => {
        const allocated = policy.proRated 
          ? Math.round(policy.daysPerYear * prorationFactor) 
          : policy.daysPerYear;

        return {
          leaveType: policy.leaveType,
          allocated,
          used: 0,
          pending: 0,
          remaining: allocated,
          carriedForward: 0
        };
      });

      balance = new EmployeeLeaveBalance({
        user: userId,
        employeeId: employeeDoc.employmentDetails.employeeId,
        year: currentYear,
        balances
      });

      await balance.save(options);
    }

    // Find the specific leave type balance
    const leaveBalance = balance.balances.find(b => b.leaveType === leaveType);
    
    if (!leaveBalance) {
      throw new ValidationError(`Leave type ${leaveType} is not configured for this employee`);
    }

    // Check if enough balance is available
    if (leaveBalance.remaining < days) {
      throw new ValidationError(
        `Insufficient ${leaveType} leave balance. ` +
        `Available: ${leaveBalance.remaining} days, Requested: ${days} days`
      );
    }

    // Update balances
    leaveBalance.pending = (leaveBalance.pending || 0) + days;
    leaveBalance.remaining = leaveBalance.remaining - days;

    balance.lastUpdated = new Date();
    await balance.save(options);

    return {
      success: true,
      message: `Leave balance updated successfully`,
      data: {
        leaveType,
        pending: leaveBalance.pending,
        remaining: leaveBalance.remaining,
        allocated: leaveBalance.allocated
      }
    };
    
  } catch (error) {
    console.error('Error updating leave balance:', error);
    throw error;
  }
},

  /**
   * Initialize holiday policy for a year
   */
  initializeHolidayPolicy: async (year: number, holidays: any[]) => {
    try {
      const policy = await HolidayPolicy.findOneAndUpdate(
        { year },
        {
          year,
          holidays,
          flexibleHolidays: 2 // Default 2 flexible holidays
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: `Holiday policy for ${year} initialized`,
        data: policy
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get holiday policy for a year
   */
  getHolidayPolicy: async (year?: number) => {
    try {
      const targetYear = year || new Date().getFullYear();
      
      let policy = await HolidayPolicy.findOne({ year: targetYear });

      if (!policy) {
        // Return empty template if not found
        policy = {
          year: targetYear,
          holidays: [],
          flexibleHolidays: 0
        } as any;
      }

      return {
        success: true,
        data: policy
      };
    } catch (error) {
      throw error;
    }
  },


    generateSalarySlip: async (userId: string, month: number, year: number) => {
      try {
        // 1. Fetch Salary details
        const salary = await Salary.findOne({ user: userId, isActive: true })
          .populate('user', 'name email');
  
        if (!salary) {
          throw new NotFoundError('Salary details not found');
        }
  
        // 2. Fetch Employee details for onboarding/joining info
        const employeeDoc = await EmployeeDocument.findOne({ user: userId });
  
        // 3. Fetch Leave balance for the specific year
        const leaveBalance = await EmployeeLeaveBalance.findOne({ 
          user: userId, 
          year 
        });
  
        // 4. Calculate days in month
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // 5. Calculate proration factor if joined mid-month
        let prorationFactor = 1;
        if (employeeDoc && employeeDoc.employmentDetails.joiningDate) {
          const joiningDate = new Date(employeeDoc.employmentDetails.joiningDate);
          if (joiningDate.getFullYear() === year && joiningDate.getMonth() + 1 === month) {
            const joiningDay = joiningDate.getDate();
            prorationFactor = (daysInMonth - joiningDay + 1) / daysInMonth;
          }
        }
  
        // 6. Calculate monthly earnings
        const monthlyEarnings = {
          basic: (salary.ctc.breakup.basic / 12) * prorationFactor,
          hra: (salary.ctc.breakup.hra / 12) * prorationFactor,
          conveyance: (salary.ctc.breakup.conveyance / 12) * prorationFactor,
          medical: (salary.ctc.breakup.medical / 12) * prorationFactor,
          special: (salary.ctc.breakup.special / 12) * prorationFactor,
          bonus: (salary.ctc.breakup.bonus / 12) * prorationFactor,
          otherAllowances: salary.ctc.breakup.otherAllowances?.map(a => ({
            name: a.name,
            amount: (a.amount / 12) * prorationFactor
          })) || []
        };
  
        // 7. Calculate monthly deductions
        const monthlyDeductions = {
          pf: (salary.deductions.pf / 12) * prorationFactor,
          professionalTax: (salary.deductions.professionalTax / 12) * prorationFactor,
          incomeTax: (salary.deductions.incomeTax / 12) * prorationFactor,
          insurance: (salary.deductions.insurance / 12) * prorationFactor,
          otherDeductions: salary.deductions.otherDeductions?.map(d => ({
            name: d.name,
            amount: (d.amount / 12) * prorationFactor
          })) || []
        };
  
        // 8. FIXED: Calculate totals using unified reduce to avoid TS operator errors
        const totalEarnings = Object.values(monthlyEarnings).reduce((sum: number, val): number => {
          if (typeof val === 'number') return sum + val;
          if (Array.isArray(val)) {
            return sum + val.reduce((s, a) => s + (a.amount || 0), 0);
          }
          return sum;
        }, 0);
  
        const totalDeductions = Object.values(monthlyDeductions).reduce((sum: number, val): number => {
          if (typeof val === 'number') return sum + val;
          if (Array.isArray(val)) {
            return sum + val.reduce((s, d) => s + (d.amount || 0), 0);
          }
          return sum;
        }, 0);
  
        const netPayable = totalEarnings - totalDeductions;
  
        // 9. Construct the finalized Salary Slip object
        const salarySlip = {
          employeeDetails: {
            name: (salary.user as any)?.name || 'N/A',
            email: (salary.user as any)?.email || 'N/A',
            employeeId: salary.employeeId,
            department: employeeDoc?.employmentDetails.department,
            designation: employeeDoc?.employmentDetails.designation,
            panNumber: employeeDoc?.bankDetails.panNumber,
            uanNumber: employeeDoc?.bankDetails.uanNumber
          },
          period: {
            month,
            year,
            daysInMonth,
            payableDays: Math.round(daysInMonth * prorationFactor)
          },
          earnings: monthlyEarnings,
          deductions: monthlyDeductions,
          summary: {
            totalEarnings: Number(totalEarnings.toFixed(2)),
            totalDeductions: Number(totalDeductions.toFixed(2)),
            netPayable: Number(netPayable.toFixed(2))
          },
          // Safe access to leave balance
          leaveBalance: leaveBalance?.balances?.find(b => b.leaveType === 'Paid') || null,
          generatedOn: new Date()
        };
  
        return {
          success: true,
          data: salarySlip
        };
  
      } catch (error: any) {
        console.error('Salary Slip Generation Error:', error);
        throw error;
      }
    }
  };