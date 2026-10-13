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

// @desc    Get Report Preview JSON Data
// @route   GET /api/reports/preview
// @access  Private
exports.getReportPreview = async (req, res, next) => {
    try {
        console.log('--- GET /api/reports/preview Query ---', req.query);
        const { type, masterType, fromDate, toDate, company, location, department, isActive, year, cycle, month, leaveType } = req.query;
        const mongoose = require('mongoose');

        // Build Employee Filter Query dynamically
        let empQuery = {};
        if (company && mongoose.Types.ObjectId.isValid(company)) {
            empQuery.company = company;
        }
        if (location && mongoose.Types.ObjectId.isValid(location)) {
            empQuery.location = location;
        }
        if (department) {
            empQuery.department = department;
        }
        if (isActive !== undefined && isActive !== '') {
            empQuery.isActive = isActive === 'true';
        }

        let data = [];

        if (type === 'attendance') {
            const employeeIds = await Employee.find(empQuery).select('_id');
            const query = buildQuery(fromDate, toDate);
            query.employee = { $in: employeeIds.map(e => e._id) };

            const records = await Attendance.find(query)
                .populate('employee', 'firstName lastName employeeId department designation')
                .sort({ date: -1 });

            data = records.map(rc => {
                let totalHours = 0;
                if (rc.checkIn && rc.checkOut) {
                    const diffMs = new Date(rc.checkOut) - new Date(rc.checkIn);
                    totalHours = parseFloat((diffMs / 3600000).toFixed(2));
                }
                return {
                    employeeId: rc.employee?.employeeId || 'N/A',
                    name: `${rc.employee?.firstName || ''} ${rc.employee?.lastName || ''}`,
                    department: rc.employee?.department || 'N/A',
                    date: rc.date,
                    checkIn: rc.checkIn,
                    checkOut: rc.checkOut,
                    status: rc.status,
                    totalHours: totalHours,
                    late: rc.lateMinutes || 0,
                    overtime: rc.overtimeHours || 0,
                    source: rc.source || 'Manual',
                    warning: rc.geoFenceWarning || '-'
                };
            });
        } 
        else if (type === 'payroll') {
            if (!month || !year) {
                return res.status(400).json({ success: false, message: 'Month and year are required' });
            }
            const employeeIds = await Employee.find(empQuery).select('_id');
            const records = await Payroll.find({
                month: parseInt(month),
                year: parseInt(year),
                employee: { $in: employeeIds.map(e => e._id) }
            }).populate('employee', 'firstName lastName employeeId department designation bankName accountNo iban');

            data = records.map(rc => ({
                employeeId: rc.employee?.employeeId || 'N/A',
                name: `${rc.employee?.firstName || ''} ${rc.employee?.lastName || ''}`,
                department: rc.employee?.department || 'N/A',
                grossPay: rc.grossPay || 0,
                totalDeductions: rc.totalDeductions || 0,
                netPay: rc.netPay || 0,
                bankName: rc.employee?.bankName || 'N/A',
                iban: rc.employee?.iban || rc.employee?.accountNo || 'N/A',
                status: rc.status
            }));
        } 
        else if (type === 'employees') {
            const employees = await Employee.find(empQuery)
                .populate('company', 'name')
                .populate('location', 'name')
                .populate('manager', 'firstName lastName')
                .sort({ firstName: 1 });

            data = employees.map(emp => ({
                employeeId: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`,
                email: emp.email,
                phone: emp.phone || '-',
                department: emp.department,
                designation: emp.designation,
                company: emp.company?.name || '-',
                location: emp.location?.name || '-',
                basicSalary: emp.basicSalary || 0,
                status: emp.isActive ? 'Active' : 'Inactive'
            }));
        }
        else if (type === 'appraisal') {
            const Appraisal = require('../models/Appraisal');
            let query = {};
            if (year) query.performanceYear = year;
            if (cycle) query.cycle = cycle;

            const employeeIds = await Employee.find(empQuery).select('_id');
            query.employee = { $in: employeeIds.map(e => e._id) };

            const appraisals = await Appraisal.find(query)
                .populate('employee', 'firstName lastName employeeId department designation')
                .populate('reviewer', 'firstName lastName')
                .sort({ performanceYear: -1 });

            data = appraisals.map(app => ({
                employeeId: app.employee?.employeeId || 'N/A',
                name: `${app.employee?.firstName || ''} ${app.employee?.lastName || ''}`,
                reviewer: app.reviewer ? `${app.reviewer.firstName} ${app.reviewer.lastName}` : 'N/A',
                year: app.performanceYear,
                cycle: app.cycle || 'Annual',
                selfRating: app.selfRating || '-',
                managerRating: app.managerRating || '-',
                finalRating: app.finalRating || '-',
                status: app.status
            }));
        }
        else if (type === 'leaves') {
            const Leave = require('../models/Leave');
            let query = {};
            if (leaveType) query.leaveType = leaveType;
            if (fromDate || toDate) {
                query.startDate = {};
                if (fromDate) query.startDate.$gte = new Date(fromDate);
                if (toDate) query.startDate.$lte = new Date(toDate);
            }

            const employeeIds = await Employee.find(empQuery).select('_id');
            query.employee = { $in: employeeIds.map(e => e._id) };

            const leaves = await Leave.find(query)
                .populate('employee', 'firstName lastName employeeId department designation')
                .sort({ startDate: -1 });

            data = leaves.map(l => ({
                employeeId: l.employee?.employeeId || 'N/A',
                name: `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`,
                department: l.employee?.department || 'N/A',
                leaveType: l.leaveType,
                startDate: l.startDate,
                endDate: l.endDate,
                duration: l.duration,
                reason: l.reason,
                status: l.status
            }));
        }
        else if (type === 'masters') {
            if (masterType === 'company') {
                const Company = require('../models/Company');
                const companies = await Company.find({}).sort({ name: 1 });
                data = companies.map(c => ({
                    id: c._id,
                    name: c.name,
                    tradeLicense: c.tradeLicenseNo || 'N/A',
                    wpsSponsorId: c.wpsSponsorId || 'N/A',
                    allowOpenAttendance: c.allowOpenAttendance ? 'Enabled' : 'Disabled'
                }));
            } else if (masterType === 'location') {
                const Location = require('../models/Location');
                const locations = await Location.find({}).sort({ name: 1 });
                data = locations.map(l => ({
                    id: l._id,
                    name: l.name,
                    coordinates: l.lat ? `${l.lat}, ${l.lng}` : 'Not Set',
                    radius: l.radius ? `${l.radius}m` : '100m'
                }));
            } else if (masterType === 'holiday') {
                const Holiday = require('../models/Holiday');
                const holidays = await Holiday.find({}).sort({ date: 1 });
                data = holidays.map(h => ({
                    id: h._id,
                    name: h.name,
                    date: h.date,
                    type: h.type || 'Public'
                }));
            } else if (masterType === 'payelement') {
                const PayElement = require('../models/PayElement');
                const elements = await PayElement.find({}).sort({ name: 1 });
                data = elements.map(e => ({
                    id: e._id,
                    name: e.name,
                    type: e.type,
                    description: e.description || '-'
                }));
            } else if (masterType === 'leave') {
                data = [
                    { name: 'Annual Leave', quota: '30 Days/Year', payType: 'Fully Paid' },
                    { name: 'Sick Leave', quota: '15 Days/Year', payType: 'Paid/Half Paid' },
                    { name: 'Maternity Leave', quota: '60 Days', payType: 'Fully Paid' },
                    { name: 'Paternity Leave', quota: '5 Days', payType: 'Fully Paid' },
                    { name: 'Unpaid Leave', quota: 'As requested', payType: 'Unpaid' }
                ];
            }
        }

        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('--- getReportPreview Error ---', error);
        next(error);
    }
};
