import { Attendance } from '../models/attendance.model'; 
import { Leave } from '../models/Leave';
import { Holiday } from '../models/Holiday';
import moment from 'moment';
import User from '../models/User';

/*r
 * Calculates individual payroll for a specific user
 */
export const calculateMonthlyPayroll = async (userId: string, month: number, year: number) => {
    const startOfMonth = moment(`${year}-${month}-01`, "YYYY-MM-DD").startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment(`${year}-${month}-01`, "YYYY-MM-DD").endOf('month').format('YYYY-MM-DD');
    const daysInMonth = moment(`${year}-${month}-01`, "YYYY-MM-DD").daysInMonth();

    // 1. Fetch Approved Attendance
    const attendanceRecords = await Attendance.find({
        user: userId,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $in: ['Present', 'Late'] }
    });

    // 2. Fetch Approved Paid Leaves (Excluding Unpaid)
    const leaves = await Leave.find({
        user: userId,
        status: 'Approved',
        startDate: { $gte: startOfMonth },
        endDate: { $lte: endOfMonth },
        leaveType: { $ne: 'Unpaid' }
    });

    // 3. Fetch Public Holidays
    const holidays = await Holiday.find({
        date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const presentDays = attendanceRecords.length;
    const leaveDays = leaves.reduce((sum, l) => sum + l.totalDays, 0);
    const holidayDays = holidays.length;

    // Standard Professional Formula
    const payableDays = presentDays + leaveDays + holidayDays;
    const lopDays = Math.max(0, daysInMonth - payableDays);

    return {
        userId,
        month: moment().month(month - 1).format('MMMM'),
        year,
        daysInMonth,
        presentDays,
        leaveDays,
        holidayDays,
        payableDays,
        lopDays,
        status: "Draft"
    };
};

/**
 * NEW: Aggregates payroll data for all employees (Admin View)
 */
export const getCompanyPayrollSummary = async (month: number, year: number) => {
    // 1. Fetch all active employees (excluding admins if necessary)
    const employees = await User.find({ role: { $ne: 'admin' }, isActive: true }).select('_id name email');

    // 2. Map through employees and calculate payroll for each
    const payrollPromises = employees.map(async (emp) => {
        const stats = await calculateMonthlyPayroll(emp.id.toString(), month, year);
        return {
            employee: {
                id: emp._id,
                name: emp.name,
                email: emp.email
            },
            ...stats
        };
    });

    const individualResults = await Promise.all(payrollPromises);

    // 3. Calculate company-wide totals for the dashboard
    const totalCompanyPayableDays = individualResults.reduce((acc, curr) => acc + curr.payableDays, 0);
    const totalCompanyLOPDays = individualResults.reduce((acc, curr) => acc + curr.lopDays, 0);

    return {
        summary: {
            totalEmployees: employees.length,
            totalPayableDays: totalCompanyPayableDays,
            totalLOPDays: totalCompanyLOPDays,
            month: moment().month(month - 1).format('MMMM'),
            year
        },
        employees: individualResults
    };
};