const ExcelJS = require('exceljs');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');

// Helper to construct query
const buildQuery = (fromDate, toDate, company, location) => {
    let query = {};
    if (fromDate || toDate) {
        query.date = {};
        if (fromDate) query.date.$gte = new Date(fromDate);
        if (toDate) query.date.$lte = new Date(toDate);
    }
    return query;
};

// @desc    Download Attendance Report
// @route   GET /api/reports/attendance
// @access  Private (Admin/HR/Manager)
exports.downloadAttendanceReport = async (req, res, next) => {
    try {
        const { fromDate, toDate, company, location } = req.query;

        // Fetch Employees matching company/location filters
        let empQuery = {};
        if (company) empQuery.company = company;
        if (location) empQuery.location = location;

        const employeeIds = await Employee.find(empQuery).select('_id company location firstName lastName employeeId');
        const empIdMap = {};
        employeeIds.forEach(e => empIdMap[e._id.toString()] = e);

        // Build Attendance Query
        const query = buildQuery(fromDate, toDate);
        query.employee = { $in: Object.keys(empIdMap) };

        const records = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .sort({ date: 1, employee: 1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');

        worksheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Check In', key: 'checkIn', width: 25 },
            { header: 'Check Out', key: 'checkOut', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Total Working Hours', key: 'totalHours', width: 20 },
            { header: 'Late (Mins)', key: 'late', width: 15 },
            { header: 'Overtime (Hrs)', key: 'overtime', width: 15 },
            { header: 'Source', key: 'source', width: 15 }
        ];

        // Format Header Row
        worksheet.getRow(1).font = { bold: true };

        records.forEach(rc => {
            let totalHours = 0;
            if (rc.checkIn && rc.checkOut) {
                const diffMs = new Date(rc.checkOut) - new Date(rc.checkIn);
                totalHours = parseFloat((diffMs / 3600000).toFixed(2));
            }

            worksheet.addRow({
                empId: rc.employee?.employeeId || 'N/A',
                name: `${rc.employee?.firstName || ''} ${rc.employee?.lastName || ''}`,
                dept: rc.employee?.department || 'N/A',
                date: new Date(rc.date).toLocaleDateString(),
                checkIn: rc.checkIn ? new Date(rc.checkIn).toLocaleString() : '-',
                checkOut: rc.checkOut ? new Date(rc.checkOut).toLocaleString() : '-',
                status: rc.status,
                totalHours: totalHours,
                late: rc.lateMinutes || 0,
                overtime: rc.overtimeHours || 0,
                source: rc.source || 'Manual'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Attendance_Report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};

// @desc    Download Payroll Report
// @route   GET /api/reports/payroll
// @access  Private (Admin/HR/Finance)
exports.downloadPayrollReport = async (req, res, next) => {
    try {
        const { month, year, company, location } = req.query;

        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'Month and year are required' });
        }

        let empQuery = {};
        if (company) empQuery.company = company;
        if (location) empQuery.location = location;

        const employeeIds = await Employee.find(empQuery).select('_id');
        const eIds = employeeIds.map(e => e._id);

        const records = await Payroll.find({
            month: parseInt(month),
            year: parseInt(year),
            employee: { $in: eIds }
        }).populate('employee', 'firstName lastName employeeId department designation bankName accountNo iban');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payroll Report');

        worksheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Gross Pay', key: 'gross', width: 15 },
            { header: 'Total Deductions', key: 'deductions', width: 20 },
            { header: 'Net Pay', key: 'net', width: 15 },
            { header: 'Bank Name', key: 'bank', width: 25 },
            { header: 'IBAN/Account Number', key: 'account', width: 30 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true };

        records.forEach(rc => {
            worksheet.addRow({
                empId: rc.employee?.employeeId || 'N/A',
                name: `${rc.employee?.firstName || ''} ${rc.employee?.lastName || ''}`,
                dept: rc.employee?.department || 'N/A',
                gross: rc.grossPay || 0,
                deductions: rc.totalDeductions || 0,
                net: rc.netPay || 0,
                bank: rc.employee?.bankName || 'N/A',
                account: rc.employee?.iban || rc.employee?.accountNo || 'N/A',
                status: rc.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Payroll_Report_${month}_${year}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};

// @desc    Download Comprehensive Employee Report
// @route   GET /api/reports/employees
// @access  Private (Admin/HR)
exports.downloadEmployeeReport = async (req, res, next) => {
    try {
        const { company, location, isActive, department } = req.query;

        let query = {};
        if (company) query.company = company;
        if (location) query.location = location;
        if (department) query.department = department;
        if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

        const employees = await Employee.find(query)
            .populate('company', 'name')
            .populate('location', 'name')
            .populate('manager', 'firstName lastName')
            .sort({ firstName: 1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Employee Details');

        worksheet.columns = [
            // Personal Info
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'First Name', key: 'firstName', width: 20 },
            { header: 'Last Name', key: 'lastName', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Date of Birth', key: 'dob', width: 15 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Nationality', key: 'nationality', width: 15 },
            { header: 'Marital Status', key: 'maritalStatus', width: 15 },
            // Employment Info
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Designation', key: 'designation', width: 25 },
            { header: 'Manager', key: 'manager', width: 25 },
            { header: 'Date of Joining', key: 'doj', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Contract Type', key: 'contractType', width: 15 },
            { header: 'MOHRE Contract', key: 'molContractType', width: 15 },
            // Company Info
            { header: 'Company', key: 'company', width: 25 },
            { header: 'Location', key: 'location', width: 20 },
            // Salary & Bank Info
            { header: 'Basic Salary (AED)', key: 'basicSalary', width: 15 },
            { header: 'Bank Name', key: 'bankName', width: 20 },
            { header: 'Account Number', key: 'accountNo', width: 25 },
            { header: 'IBAN', key: 'iban', width: 30 },
            { header: 'WPS Agent Code', key: 'wpsAgentCode', width: 15 },
            // Compliance & Documents
            { header: 'Visa Type', key: 'visaType', width: 15 },
            { header: 'Visa Expiry', key: 'visaExpiry', width: 15 },
            { header: 'Emirates ID', key: 'emiratesId', width: 20 },
            { header: 'Passport No', key: 'passportNo', width: 15 },
            { header: 'Passport Expiry', key: 'passportExpiry', width: 15 },
        ];

        worksheet.getRow(1).font = { bold: true };

        employees.forEach(emp => {
            worksheet.addRow({
                empId: emp.employeeId,
                firstName: emp.firstName,
                lastName: emp.lastName,
                email: emp.email,
                phone: emp.phone || '-',
                dob: emp.dob ? new Date(emp.dob).toLocaleDateString() : '-',
                gender: emp.gender,
                nationality: emp.nationality,
                maritalStatus: emp.maritalStatus || '-',
                department: emp.department,
                designation: emp.designation,
                manager: emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '-',
                doj: emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '-',
                status: emp.isActive ? 'Active' : 'Inactive',
                contractType: emp.contractType || '-',
                molContractType: emp.molContractType || '-',
                company: emp.company?.name || '-',
                location: emp.location?.name || '-',
                basicSalary: emp.basicSalary || 0,
                bankName: emp.bankName || '-',
                accountNo: emp.accountNo || '-',
                iban: emp.iban || '-',
                wpsAgentCode: emp.wpsAgentCode || '-',
                visaType: emp.visaType || '-',
                visaExpiry: emp.visaExpiry ? new Date(emp.visaExpiry).toLocaleDateString() : '-',
                emiratesId: emp.emiratesId || '-',
                passportNo: emp.passportNo || '-',
                passportExpiry: emp.passportExpiry ? new Date(emp.passportExpiry).toLocaleDateString() : '-',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Employee_Report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};

// @desc    Download Appraisal Report
// @route   GET /api/reports/appraisals
// @access  Private (Admin/HR)
exports.downloadAppraisalReport = async (req, res, next) => {
    try {
        const { year, cycle, company } = req.query;

        // Note: we need to import Appraisal at the top if it's not and TravelRequest, Leave.
        const Appraisal = require('../models/Appraisal');

        let query = {};
        if (year) query.performanceYear = year;
        if (cycle) query.cycle = cycle;

        let empQuery = {};
        if (company) empQuery.company = company;

        const employeeIds = await Employee.find(empQuery).select('_id');
        query.employee = { $in: employeeIds.map(e => e._id) };

        const appraisals = await Appraisal.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .populate('reviewer', 'firstName lastName')
            .sort({ performanceYear: -1, cycle: 1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Appraisal Report');

        worksheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Employee Name', key: 'name', width: 25 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Designation', key: 'title', width: 20 },
            { header: 'Reviewer', key: 'reviewer', width: 25 },
            { header: 'Year', key: 'year', width: 10 },
            { header: 'Cycle', key: 'cycle', width: 10 },
            { header: 'Self Rating', key: 'self', width: 15 },
            { header: 'Manager Rating', key: 'manager', width: 15 },
            { header: 'Final Rating', key: 'final', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        worksheet.getRow(1).font = { bold: true };

        appraisals.forEach(app => {
            worksheet.addRow({
                empId: app.employee?.employeeId || 'N/A',
                name: `${app.employee?.firstName || ''} ${app.employee?.lastName || ''}`,
                dept: app.employee?.department || 'N/A',
                title: app.employee?.designation || 'N/A',
                reviewer: app.reviewer ? `${app.reviewer.firstName} ${app.reviewer.lastName}` : 'N/A',
                year: app.performanceYear,
                cycle: app.cycle || 'Annual',
                self: app.selfRating || '-',
                manager: app.managerRating || '-',
                final: app.finalRating || '-',
                status: app.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Appraisal_Report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};

// @desc    Download Travel & Expense Report
// @route   GET /api/reports/travels
// @access  Private (Admin/HR/Finance)
exports.downloadTravelReport = async (req, res, next) => {
    try {
        const { fromDate, toDate, company } = req.query;

        const TravelRequest = require('../models/TravelRequest');

        let query = {};
        if (fromDate || toDate) {
            query.fromDate = {};
            if (fromDate) query.fromDate.$gte = new Date(fromDate);
            if (toDate) query.fromDate.$lte = new Date(toDate);
        }

        let empQuery = {};
        if (company) empQuery.company = company;

        const employeeIds = await Employee.find(empQuery).select('_id');
        query.employee = { $in: employeeIds.map(e => e._id) };

        const travels = await TravelRequest.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .sort({ fromDate: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Travel Report');

        worksheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Employee Name', key: 'name', width: 25 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Destination', key: 'destination', width: 20 },
            { header: 'Purpose', key: 'purpose', width: 25 },
            { header: 'From Date', key: 'fromDate', width: 15 },
            { header: 'To Date', key: 'toDate', width: 15 },
            { header: 'Est. Budget', key: 'budget', width: 15 },
            { header: 'Requested Advance', key: 'reqAdvance', width: 20 },
            { header: 'Approved Advance', key: 'appAdvance', width: 20 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true };

        travels.forEach(t => {
            worksheet.addRow({
                empId: t.employee?.employeeId || 'N/A',
                name: `${t.employee?.firstName || ''} ${t.employee?.lastName || ''}`,
                dept: t.employee?.department || 'N/A',
                destination: t.destination,
                purpose: t.purpose,
                fromDate: new Date(t.fromDate).toLocaleDateString(),
                toDate: new Date(t.toDate).toLocaleDateString(),
                budget: t.estimatedBudget,
                reqAdvance: t.requestedAdvance || 0,
                appAdvance: t.approvedAdvance || 0,
                status: t.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Travel_Report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};

// @desc    Download Leave Report
// @route   GET /api/reports/leaves
// @access  Private (Admin/HR/Manager)
exports.downloadLeaveReport = async (req, res, next) => {
    try {
        const { fromDate, toDate, company, leaveType } = req.query;

        const Leave = require('../models/Leave');

        let query = {};
        if (leaveType) query.leaveType = leaveType;
        if (fromDate || toDate) {
            query.startDate = {};
            if (fromDate) query.startDate.$gte = new Date(fromDate);
            if (toDate) query.startDate.$lte = new Date(toDate);
        }

        let empQuery = {};
        if (company) empQuery.company = company;

        const employeeIds = await Employee.find(empQuery).select('_id');
        query.employee = { $in: employeeIds.map(e => e._id) };

        const leaves = await Leave.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .sort({ startDate: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leave Report');

        worksheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Employee Name', key: 'name', width: 25 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Leave Type', key: 'type', width: 20 },
            { header: 'Start Date', key: 'start', width: 15 },
            { header: 'End Date', key: 'end', width: 15 },
            { header: 'Days', key: 'days', width: 10 },
            { header: 'Reason', key: 'reason', width: 30 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true };

        leaves.forEach(l => {
            worksheet.addRow({
                empId: l.employee?.employeeId || 'N/A',
                name: `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`,
                dept: l.employee?.department || 'N/A',
                type: l.leaveType,
                start: new Date(l.startDate).toLocaleDateString(),
                end: new Date(l.endDate).toLocaleDateString(),
                days: l.duration,
                reason: l.reason,
                status: l.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Leave_Report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};

// @desc    Download Payroll Register (comprehensive frozen-month report)
// @route   GET /api/reports/payroll-register
// @access  Private (Admin/HR/Finance)
exports.downloadPayrollRegister = async (req, res, next) => {
    try {
        const { month, year, company, location } = req.query;

        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'Month and year are required' });
        }

        const m = parseInt(month);
        const y = parseInt(year);

        // Verify period is frozen
        const frozenCheck = await Payroll.findOne({ month: m, year: y, isFrozen: true });
        if (!frozenCheck) {
            return res.status(400).json({ success: false, message: 'Payroll for this period is not frozen. Only frozen periods can be exported as a register.' });
        }

        // Build employee filter
        let empQuery = { isActive: true };
        if (company) empQuery.company = company;
        if (location) empQuery.location = location;

        const filteredEmployees = await Employee.find(empQuery).select('_id');
        const empIds = filteredEmployees.map(e => e._id);

        // Get payroll records
        const records = await Payroll.find({
            month: m,
            year: y,
            employee: { $in: empIds }
        }).populate({
            path: 'employee',
            populate: [
                { path: 'company', select: 'name' },
                { path: 'location', select: 'name' }
            ]
        });

        if (records.length === 0) {
            return res.status(404).json({ success: false, message: 'No payroll records found for this period with the selected filters' });
        }

        // Fetch attendance aggregates for all employees in this month
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0, 23, 59, 59);

        const attendanceAgg = await Attendance.aggregate([
            { $match: { employee: { $in: empIds }, date: { $gte: monthStart, $lte: monthEnd } } },
            {
                $group: {
                    _id: '$employee',
                    presentDays: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                    absentDays: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
                    halfDays: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 0.5, 0] } },
                    overtimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
                    holidayOvertimeHours: { $sum: { $ifNull: ['$holidayOvertimeHours', 0] } },
                    lateMinutes: { $sum: { $ifNull: ['$lateMinutes', 0] } },
                    onLeaveDays: { $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] } }
                }
            }
        ]);
        const attMap = {};
        attendanceAgg.forEach(a => { attMap[a._id.toString()] = a; });

        // Fetch leave aggregates for all employees in this month
        const Leave = require('../models/Leave');
        const leaveAgg = await Leave.aggregate([
            {
                $match: {
                    employee: { $in: empIds },
                    status: 'Approved',
                    $or: [
                        { fromDate: { $lte: monthEnd }, toDate: { $gte: monthStart } }
                    ]
                }
            },
            {
                $group: {
                    _id: { employee: '$employee', leaveType: '$leaveType' },
                    totalDays: { $sum: '$totalDays' }
                }
            }
        ]);

        // Build leave map: empId -> { paidLeaveDays, unpaidLeaveDays, sickLeaveDays }
        const leaveMap = {};
        const paidLeaveTypes = ['Annual', 'Maternity', 'Paternity', 'Hajj', 'Compassionate'];
        leaveAgg.forEach(l => {
            const empId = l._id.employee.toString();
            if (!leaveMap[empId]) leaveMap[empId] = { paidLeaveDays: 0, unpaidLeaveDays: 0, sickLeaveDays: 0 };

            if (l._id.leaveType === 'Sick') {
                leaveMap[empId].sickLeaveDays += l.totalDays;
            } else if (l._id.leaveType === 'Unpaid') {
                leaveMap[empId].unpaidLeaveDays += l.totalDays;
            } else if (paidLeaveTypes.includes(l._id.leaveType)) {
                leaveMap[empId].paidLeaveDays += l.totalDays;
            }
        });

        // Collect all unique dynamic pay element names (allowances)
        const allAllowanceNames = new Set();
        records.forEach(rc => {
            if (rc.earnings.allowances && rc.earnings.allowances.length > 0) {
                rc.earnings.allowances.forEach(a => {
                    if (a.name) allAllowanceNames.add(a.name);
                });
            }
        });
        const sortedAllowanceNames = Array.from(allAllowanceNames).sort();

        // Month name for display
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        // Build Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payroll Register');

        // Static columns
        const columns = [
            { header: 'Company', key: 'company', width: 25 },
            { header: 'Location', key: 'location', width: 20 },
            { header: 'Salary Month', key: 'salaryMonth', width: 18 },
            { header: 'Payroll Status', key: 'payrollStatus', width: 15 },
            { header: 'Emp Code', key: 'empCode', width: 15 },
            { header: 'Employee Name', key: 'empName', width: 25 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Designation', key: 'designation', width: 20 },
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Date of Joining', key: 'doj', width: 15 },
            { header: 'Contract Type', key: 'contractType', width: 15 },
            { header: 'Currency', key: 'currency', width: 10 },
            // Attendance
            { header: 'Present Days', key: 'presentDays', width: 13 },
            { header: 'Absent Days', key: 'absentDays', width: 13 },
            { header: 'Paid Leave Days', key: 'paidLeaveDays', width: 15 },
            { header: 'Unpaid Leave Days', key: 'unpaidLeaveDays', width: 16 },
            { header: 'Sick Leave', key: 'sickLeaveDays', width: 12 },
            { header: 'Overtime Hours', key: 'overtimeHours', width: 15 },
            { header: 'Late Minutes', key: 'lateMinutes', width: 13 },
            // Standard earnings & deductions
            { header: 'Basic Salary', key: 'basicSalary', width: 15 },
            { header: 'Leave Deduction', key: 'leaveDeduction', width: 16 },
            { header: 'Late Deduction', key: 'lateDeduction', width: 15 },
            { header: 'Loan/EMI', key: 'loanEMI', width: 12 },
            { header: 'Advance Recovery', key: 'advanceRecovery', width: 16 },
            { header: 'Other Deductions', key: 'otherDeductions', width: 16 },
        ];

        // Dynamic allowance columns
        sortedAllowanceNames.forEach(name => {
            columns.push({ header: name, key: `allowance_${name}`, width: 18 });
        });

        // Totals
        columns.push(
            { header: 'Gross Salary', key: 'grossSalary', width: 15 },
            { header: 'Total Deductions', key: 'totalDeductions', width: 16 },
            { header: 'Net Salary', key: 'netSalary', width: 15 }
        );

        worksheet.columns = columns;

        // Format header
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        headerRow.height = 30;

        // Add data rows
        records.forEach(rc => {
            const emp = rc.employee;
            const empId = emp?._id?.toString() || '';
            const att = attMap[empId] || {};
            const lv = leaveMap[empId] || {};

            const row = {
                company: emp?.company?.name || '-',
                location: emp?.location?.name || '-',
                salaryMonth: `${monthNames[m - 1]} ${y}`,
                payrollStatus: rc.isFrozen ? 'Frozen' : rc.status,
                empCode: emp?.employeeId || 'N/A',
                empName: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim(),
                gender: emp?.gender || '-',
                designation: emp?.designation || '-',
                department: emp?.department || '-',
                doj: emp?.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '-',
                contractType: emp?.contractType || '-',
                currency: 'AED',
                // Attendance
                presentDays: att.presentDays || 0,
                absentDays: (att.absentDays || 0) + (att.halfDays || 0),
                paidLeaveDays: lv.paidLeaveDays || 0,
                unpaidLeaveDays: lv.unpaidLeaveDays || 0,
                sickLeaveDays: lv.sickLeaveDays || 0,
                overtimeHours: parseFloat(((att.overtimeHours || 0) + (att.holidayOvertimeHours || 0)).toFixed(2)),
                lateMinutes: att.lateMinutes || 0,
                // Standard earnings/deductions
                basicSalary: rc.earnings.basic || 0,
                leaveDeduction: rc.deductions.leaveDeduction || 0,
                lateDeduction: rc.deductions.lateDeduction || 0,
                loanEMI: rc.deductions.loanEMI || 0,
                advanceRecovery: rc.deductions.advanceRecoveryDeduction || 0,
                otherDeductions: rc.deductions.otherDeductions || 0,
                // Totals
                grossSalary: rc.grossPay || 0,
                totalDeductions: rc.totalDeductions || 0,
                netSalary: rc.netPay || 0,
            };

            // Dynamic allowance values
            const allowanceMap = {};
            if (rc.earnings.allowances && rc.earnings.allowances.length > 0) {
                rc.earnings.allowances.forEach(a => {
                    if (a.name) allowanceMap[a.name] = a.amount || 0;
                });
            }
            sortedAllowanceNames.forEach(name => {
                row[`allowance_${name}`] = allowanceMap[name] || 0;
            });

            worksheet.addRow(row);
        });

        // Auto-format number columns
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.alignment = { vertical: 'middle' };
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Payroll_Register_${m}_${y}.xlsx`);

        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (error) {
        next(error);
    }
};
