const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const attendanceService = require('../services/attendanceService');
const xlsx = require('xlsx');

// Helper: check if a date falls in a frozen payroll month
const isDateInFrozenPayroll = async (employeeId, date) => {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const frozen = await Payroll.findOne({ employee: employeeId, month, year, isFrozen: true });
    return !!frozen;
};

// @desc    Get attendance for all employees within a date range
// @route   GET /api/attendance?startDate=...&endDate=...
// @access  Private (HR/Manager)
exports.getAttendance = async (req, res, next) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // Role-Based Filtering
        const userRole = req.user.role?.name || req.user.role;
        const employeeRefId = req.user.employeeRef;

        if (userRole === 'admin' || userRole === 'hr') {
            // Can see anyone
            if (employeeId) query.employee = employeeId;
        } else {
            // Find if this user manages anyone
            const subordinates = await Employee.find({ manager: employeeRefId }).select('_id');

            if (subordinates.length > 0 || userRole === 'manager') {
                const subIds = subordinates.map(s => s._id);
                // Can see themselves + subordinates
                const allowedIds = [employeeRefId, ...subIds];

                if (employeeId) {
                    // Check if they are requesting someone they manage
                    const isAllowed = allowedIds.some(id => id && id.toString() === employeeId.toString());
                    if (isAllowed) {
                        query.employee = employeeId;
                    } else {
                        return res.status(403).json({ success: false, message: 'Not authorized to view this employee' });
                    }
                } else {
                    query.employee = { $in: allowedIds };
                }
            } else {
                // Standard employees can only see their own attendance
                query.employee = employeeRefId;
            }
        }

        const attendance = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeId department manager')
            .sort({ date: -1 });

        res.status(200).json({ success: true, count: attendance.length, data: attendance });
    } catch (error) {
        next(error);
    }
};

// @desc    Add manual attendance entry
// @route   POST /api/attendance
// @access  Private (HR/Manager)
exports.addAttendance = async (req, res, next) => {
    try {
        const { employee, date, checkIn, checkOut, status, source } = req.body;

        if (!employee || !date || (!checkIn && status !== 'Absent' && status !== 'On Leave')) {
            return res.status(400).json({ success: false, message: 'Please provide employee, date, and valid check-in' });
        }

        const record = await attendanceService.processAttendanceEntry(
            employee, date, checkIn, checkOut, source || 'Manual'
        );

        res.status(201).json({ success: true, data: record });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Attendance for this date already exists.' });
        }
        next(error);
    }
};

// @desc    Bulk upload attendance via Excel
// @route   POST /api/attendance/bulk
// @access  Private (HR/Admin)
exports.bulkUploadAttendance = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
        }

        // Parse Excel file
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'The uploaded file is empty' });
        }

        let processedCount = 0;
        let deletedCount = 0;
        let errors = [];

        // Expected headers: Employee ID, Date (YYYY-MM-DD), Check In (HH:mm), Check Out (HH:mm)
        for (const row of rows) {
            try {
                // Find employee by Employee ID (EMP-001)
                const employeeIdField = row['Employee ID'] || row['EmployeeID'] || row['EMPLOYEE_ID'];
                if (!employeeIdField) throw new Error('Missing Employee ID column');

                const employee = await Employee.findOne({ employeeId: employeeIdField });

                if (!employee) {
                    errors.push(`Row skipped - Employee ${employeeIdField} not found in system.`);
                    continue;
                }

                // Parse Dates correctly
                const dateVal = row['Date']; // e.g., '2026-02-26'
                let checkInVal = row['Check In']; // e.g., '09:15'
                let checkOutVal = row['Check Out'];
                const actionField = (row['Action'] || row['STATUS'] || row['Status'] || '').toString().trim().toUpperCase();

                // Convert Excel Serial Dates if needed
                let recordDate;
                if (typeof dateVal === 'number') {
                    // Excel epoch is 1900-01-01
                    recordDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                } else {
                    recordDate = new Date(dateVal);
                }

                // Handle DELETE action
                if (actionField === 'DELETE') {
                    const frozen = await isDateInFrozenPayroll(employee._id, recordDate);
                    if (frozen) {
                        errors.push(`Row skipped - Cannot delete ${employeeIdField} on ${recordDate.toLocaleDateString()}: payroll is frozen for this month.`);
                        continue;
                    }
                    const normalizedDate = new Date(recordDate);
                    normalizedDate.setHours(0, 0, 0, 0);
                    const deleted = await Attendance.findOneAndDelete({ employee: employee._id, date: normalizedDate });
                    if (deleted) {
                        deletedCount++;
                    } else {
                        errors.push(`Row skipped - No attendance record found for ${employeeIdField} on ${recordDate.toLocaleDateString()}.`);
                    }
                    continue;
                }

                let checkInDate = null;
                let checkOutDate = null;

                const createDateTime = (baseDate, timeStr) => {
                    if (!timeStr) return null;
                    const result = new Date(baseDate);
                    // if time is dec fraction from excel
                    if (typeof timeStr === 'number') {
                        const totalSec = Math.round(timeStr * 24 * 60 * 60);
                        const h = Math.floor(totalSec / 3600);
                        const m = Math.floor((totalSec % 3600) / 60);
                        result.setHours(h, m, 0, 0);
                    } else if (typeof timeStr === 'string' && timeStr.includes(':')) {
                        const parts = timeStr.split(':');
                        result.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
                    }
                    return result;
                };

                checkInDate = createDateTime(recordDate, checkInVal);
                checkOutDate = createDateTime(recordDate, checkOutVal);

                await attendanceService.processAttendanceEntry(
                    employee._id,
                    recordDate,
                    checkInDate,
                    checkOutDate,
                    'Excel'
                );

                processedCount++;
            } catch (err) {
                errors.push(`Error processing row: ${err.message}`);
            }
        }

        res.status(200).json({
            success: true,
            message: `Processed ${processedCount} records${deletedCount > 0 ? `, deleted ${deletedCount} records` : ''}.`,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Delete a single attendance record
// @route   DELETE /api/attendance/:id
// @access  Private (HR/Admin)
exports.deleteAttendance = async (req, res, next) => {
    try {
        const record = await Attendance.findById(req.params.id);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }

        // Check if record is locked
        if (record.isLocked) {
            return res.status(403).json({ success: false, message: 'Cannot delete a locked attendance record' });
        }

        // Check if payroll for this month is frozen
        const frozen = await isDateInFrozenPayroll(record.employee, record.date);
        if (frozen) {
            return res.status(403).json({ success: false, message: 'Cannot delete attendance — payroll for this month is frozen' });
        }

        await Attendance.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Attendance record deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Lock attendance 
// @route   POST /api/attendance/lock
// @access  Private (HR/Admin)
exports.lockAttendance = async (req, res, next) => {
    try {
        const { year, month } = req.body;

        if (!year || !month) {
            return res.status(400).json({ success: false, message: 'Please provide year and month' });
        }

        const count = await attendanceService.lockMonthAttendance(year, month);
        res.status(200).json({ success: true, message: `Locked ${count} attendance records for ${year}-${month}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Handle Biometric Web Punch (In/Out)
// @route   POST /api/attendance/punch
// @access  Private (Employee+)
exports.punchInOut = async (req, res, next) => {
    try {
        const { type, lat, lng, faceMatchScore, faceMatchFailed } = req.body;
        const employeeId = req.user.employeeRef;

        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'User is not linked to an employee profile.' });
        }

        if (!type || (type !== 'in' && type !== 'out')) {
            return res.status(400).json({ success: false, message: 'Invalid punch type.' });
        }

        const photoPath = req.file ? req.file.path.replace(/\\/g, '/') : null;

        let location = null;
        if (lat && lng) {
            location = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }

        const record = await attendanceService.processBiometricPunch(
            employeeId,
            type,
            location,
            photoPath,
            faceMatchScore !== undefined ? parseFloat(faceMatchScore) : undefined,
            faceMatchFailed === 'true' || faceMatchFailed === true
        );

        res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};
// @desc    Approve or Reject Biometric Attendance or Missed Punch Requests
// @route   PUT /api/attendance/:id/approve
// @access  Private (Manager, HR, Admin)
exports.approveAttendance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Approved' or 'Rejected'
        const userRole = req.user.role?.name || req.user.role;

        const record = await Attendance.findById(id).populate('employee');
        if (!record) {
            return res.status(404).json({ success: false, message: 'Attendance record not found.' });
        }

        if (record.isLocked) {
            return res.status(400).json({ success: false, message: 'Cannot modify a locked attendance record.' });
        }

        if (status === 'Rejected') {
            record.approvalStatus = 'Rejected';

            if (record.isRequestPending) {
                record.isRequestPending = false;
            } else {
                record.status = 'Absent';
                record.overtimeHours = 0;
            }

            await record.save();
            return res.status(200).json({ success: true, data: record });
        }

        // Two-tier authorization flow
        if (userRole === 'manager') {
            if (record.approvalStatus === 'Pending Manager') {
                record.approvalStatus = 'Pending HR';
            }
        } else if (userRole === 'hr' || userRole === 'admin') {
            record.approvalStatus = 'Approved';

            // If a missed punch request is being approved, merge with any existing record for the same date
            if (record.isRequestPending) {
                const employeeId = record.employee._id || record.employee;
                const { startOfDay, endOfDay } = getLocalDayRange(record.date);

                // Find ALL records for this employee on this day (could be biometric + manual duplicate)
                const allRecords = await Attendance.find({
                    employee: employeeId,
                    date: { $gte: startOfDay, $lte: endOfDay },
                    _id: { $ne: record._id }
                });

                // Merge: start with existing record's times
                let mergedCheckIn = record.checkIn;
                let mergedCheckOut = record.checkOut;

                // Only apply requested times that were ACTUALLY provided by the employee
                if (record.requestedCheckIn) mergedCheckIn = record.requestedCheckIn;
                if (record.requestedCheckOut) mergedCheckOut = record.requestedCheckOut;

                // Fill in any still-missing fields from duplicate records
                for (const otherRecord of allRecords) {
                    if (!mergedCheckIn && otherRecord.checkIn) mergedCheckIn = otherRecord.checkIn;
                    if (!mergedCheckOut && otherRecord.checkOut) mergedCheckOut = otherRecord.checkOut;
                    // Keep biometric metadata from the other record if this one doesn't have it
                    if (!record.punchInPhoto && otherRecord.punchInPhoto) {
                        record.punchInPhoto = otherRecord.punchInPhoto;
                        record.punchInLocation = otherRecord.punchInLocation;
                    }
                    if (!record.punchOutPhoto && otherRecord.punchOutPhoto) {
                        record.punchOutPhoto = otherRecord.punchOutPhoto;
                        record.punchOutLocation = otherRecord.punchOutLocation;
                    }
                    if (otherRecord.faceMatchScore !== undefined) {
                        record.faceMatchScore = otherRecord.faceMatchScore;
                        record.faceMatchFailed = otherRecord.faceMatchFailed;
                    }
                    // Delete the duplicate record
                    await Attendance.findByIdAndDelete(otherRecord._id);
                }

                record.checkIn = mergedCheckIn;
                record.checkOut = mergedCheckOut;

                // Recalculate status based on merged times
                const { status: calculatedStatus, lateMinutes, overtimeHours, holidayOvertimeHours } =
                    await attendanceService.calculateBiometricStatus(record.checkIn, record.checkOut, employeeId);

                record.status = calculatedStatus;
                record.lateMinutes = lateMinutes;
                record.overtimeHours = overtimeHours;
                record.holidayOvertimeHours = holidayOvertimeHours;

                record.isRequestPending = false;
                record.source = record.punchInPhoto ? 'Biometric' : 'Manual';
            }
        }

        await record.save();
        res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

// Helper: get start/end of calendar day in LOCAL timezone (matches biometric date storage)
function getLocalDayRange(dateInput) {
    const d = new Date(dateInput);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { startOfDay, endOfDay };
}

// @desc    Submit Employee Attendance Request (Missed Punch / Manual Entry)
// @route   POST /api/attendance/request
// @access  Private
exports.requestAttendance = async (req, res, next) => {
    try {
        const { date, requestType, requestedCheckIn, requestedCheckOut, reason } = req.body;
        const employeeId = req.user.employeeRef;

        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'User is not linked to an employee profile.' });
        }

        if (!date || !requestType || !reason) {
            return res.status(400).json({ success: false, message: 'Please provide date, request type, and reason.' });
        }

        if (!requestedCheckIn && !requestedCheckOut) {
            return res.status(400).json({ success: false, message: 'Please provide at least a Check-In or Check-Out time.' });
        }

        // Use LOCAL timezone day boundaries (consistent with how biometric stores dates)
        const { startOfDay, endOfDay } = getLocalDayRange(date);

        let record = await Attendance.findOne({
            employee: employeeId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (record && record.isLocked) {
            return res.status(400).json({ success: false, message: 'Cannot request changes for a locked month.' });
        }

        if (record && record.isRequestPending) {
            return res.status(400).json({ success: false, message: 'You already have a pending request for this date.' });
        }

        if (!record) {
            // Create a shell record for manual entry, using LOCAL midnight (same as biometric)
            record = new Attendance({
                employee: employeeId,
                date: startOfDay,
                status: 'Absent',
                source: 'Manual'
            });
        }

        // Apply request fields — ONLY store what the employee actually provided
        record.isRequestPending = true;
        record.requestType = requestType;
        record.requestedCheckIn = requestedCheckIn ? new Date(requestedCheckIn) : null;
        record.requestedCheckOut = requestedCheckOut ? new Date(requestedCheckOut) : null;
        record.requestReason = reason;
        record.approvalStatus = 'Pending Manager';

        await record.save();

        res.status(201).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};
