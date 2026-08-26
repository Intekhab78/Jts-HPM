const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const attendanceService = require('../services/attendanceService');
const xlsx = require('xlsx');

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
        let errors = [];

        // Detect if this is a Hik-Connect exported transaction sheet
        const hasId = rows[0]['ID'] !== undefined;
        const hasTime = rows[0]['Time'] !== undefined;
        const hasDate = rows[0]['Date'] !== undefined;
        const isHikConnectExport = hasId && hasTime && hasDate && rows[0]['Employee ID'] === undefined;

        if (isHikConnectExport) {
            const BiometricLog = require('../models/BiometricLog');
            
            // Helper function to build DateTime from excel values
            const parseRowDateTime = (row) => {
                const dateVal = row['Date'];
                const timeVal = row['Time'];
                let dateObj;
                if (typeof dateVal === 'number') {
                    dateObj = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                } else {
                    dateObj = new Date(dateVal);
                }
                
                if (typeof timeVal === 'number') {
                    const totalSec = Math.round(timeVal * 24 * 60 * 60);
                    const h = Math.floor(totalSec / 3600);
                    const m = Math.floor((totalSec % 3600) / 60);
                    dateObj.setHours(h, m, 0, 0);
                } else if (typeof timeVal === 'string' && timeVal.includes(':')) {
                    const parts = timeVal.split(':');
                    dateObj.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
                }
                return dateObj;
            };

            // Sort chronologically before parsing to ensure punches are added sequentially
            const sortedRows = rows.map(r => ({ ...r, parsedDateTime: parseRowDateTime(r) }))
                                  .sort((a, b) => a.parsedDateTime - b.parsedDateTime);

            for (const row of sortedRows) {
                try {
                    const biometricId = String(row['ID']).trim();
                    const punchDateTime = row.parsedDateTime;
                    const deviceName = row['Device Name'] || 'Hik-Connect Excel';
                    const deviceSerial = row['Device Serial No.'] || 'Unknown';
                    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

                    // Find employee mapping
                    const employee = await Employee.findOne({ 'biometricMappings.biometricId': biometricId });

                    const log = new BiometricLog({
                        biometricId,
                        timestamp: punchDateTime,
                        deviceBrand: 'Hikvision',
                        deviceName: `${deviceName} (SN: ${deviceSerial})`,
                        deviceIp: ip,
                        type: 'Punch',
                        rawPayload: row,
                        status: 'Pending'
                    });

                    if (!employee) {
                        log.status = 'Failed';
                        log.errorMessage = `No employee mapped to Biometric ID: ${biometricId}`;
                        await log.save();
                        errors.push(`Row ignored - Biometric ID ${biometricId} not mapped to any employee.`);
                        continue;
                    }

                    log.employee = employee._id;

                    // Save attendance records
                    await attendanceService.processBiometricLog(
                        employee._id,
                        punchDateTime,
                        'Punch',
                        'Hikvision'
                    );

                    log.status = 'Processed';
                    await log.save();
                    processedCount++;
                } catch (err) {
                    errors.push(`Error processing Hik-Connect row: ${err.message}`);
                }
            }
        } else {
            // Expected headers: Employee ID, Date (YYYY-MM-DD), Check In (HH:mm), Check Out (HH:mm)
            for (const row of rows) {
                try {
                    // Find employee by Employee ID (EMP-001)
                    const employeeIdField = row['Employee ID'] || row['EmployeeID'] || row['EMPLOYEE_ID'];
                    if (!employeeIdField) throw new Error('Missing Employee ID column');

                    const employee = await Employee.findOne({ employeeId: employeeIdField });

                    if (!employee) {
                        errors.push(`Row hidden - Employee ${employeeIdField} not found in system.`);
                        continue;
                    }

                    // Parse Dates correctly
                    const dateVal = row['Date']; // e.g., '2026-02-26'
                    let checkInVal = row['Check In']; // e.g., '09:15'
                    let checkOutVal = row['Check Out'];

                    // Convert Excel Serial Dates if needed
                    let recordDate;
                    if (typeof dateVal === 'number') {
                        // Excel epoch is 1900-01-01
                        recordDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                    } else {
                        recordDate = new Date(dateVal);
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
        }

        res.status(200).json({
            success: true,
            message: `Processed ${processedCount} records.`,
            errors: errors.length > 0 ? errors : undefined
        });

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

            // If rejecting a request, simply clear the request but don't delete the day
            if (record.isRequestPending) {
                record.isRequestPending = false;
            } else {
                record.status = 'Absent'; // Invalidate the day for regular biometric rejections
                record.overtimeHours = 0;
            }

            await record.save();
            return res.status(200).json({ success: true, data: record });
        }

        // Two-tier authorization flow
        if (userRole === 'manager') {
            // Managers can only approve their own subordinates mapping (if implemented)
            // For now, we transition from Pending Manager -> Pending HR
            if (record.approvalStatus === 'Pending Manager') {
                record.approvalStatus = 'Pending HR';
            }
        } else if (userRole === 'hr' || userRole === 'admin') {
            // HR/Admin can approve anything
            record.approvalStatus = 'Approved';

            // If a request was pending and fully approved, apply the requested times
            if (record.isRequestPending) {
                record.checkIn = record.requestedCheckIn || record.checkIn;
                record.checkOut = record.requestedCheckOut || record.checkOut;

                // Recalculate status based on new times
                const { status: calculatedStatus, lateMinutes, overtimeHours, holidayOvertimeHours } =
                    attendanceService.calculateBiometricStatus(record.checkIn, record.checkOut);

                record.status = calculatedStatus;
                record.lateMinutes = lateMinutes;
                record.overtimeHours = overtimeHours;
                record.holidayOvertimeHours = holidayOvertimeHours;

                record.isRequestPending = false;
                record.source = 'Manual'; // Must be one of the enum values: 'Manual', 'Biometric', 'Excel', 'API'
            }
        }

        await record.save();
        res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

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

        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);

        let record = await Attendance.findOne({ employee: employeeId, date: normalizedDate });

        if (record && record.isLocked) {
            return res.status(400).json({ success: false, message: 'Cannot request changes for a locked month.' });
        }

        if (record && record.isRequestPending) {
            return res.status(400).json({ success: false, message: 'You already have a pending request for this date.' });
        }

        if (!record) {
            // Create a shell record for manual entry
            record = new Attendance({
                employee: employeeId,
                date: normalizedDate,
                status: 'Absent',
                source: 'Manual'
            });
        }

        // Apply request fields
        record.isRequestPending = true;
        record.requestType = requestType;
        record.requestedCheckIn = requestedCheckIn ? new Date(requestedCheckIn) : record.checkIn;
        record.requestedCheckOut = requestedCheckOut ? new Date(requestedCheckOut) : record.checkOut;
        record.requestReason = reason;
        record.approvalStatus = 'Pending Manager';

        await record.save();

        res.status(201).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};
