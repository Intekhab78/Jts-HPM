const Attendance = require('../models/Attendance');
const WorkingDayOverride = require('../models/WorkingDayOverride');
const Employee = require('../models/Employee');
const AttendanceSettings = require('../models/AttendanceSettings');

// Fallback defaults if DB settings don't exist yet
const DEFAULTS = {
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    expectedWorkingHours: 9,
    lateMarkingEnabled: true,
    lateGraceMinutes: 15,
    overtimeEnabled: true,
    otMinimumMinutes: 60,
    halfDayThresholdMinutes: null
};

// Cache settings for 60 seconds to avoid DB hit every attendance calculation
let cachedSettings = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000;

const getSettings = async () => {
    const now = Date.now();
    if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedSettings;
    }
    try {
        const settings = await AttendanceSettings.findOne();
        cachedSettings = settings || DEFAULTS;
        cacheTimestamp = now;
        return cachedSettings;
    } catch {
        return DEFAULTS;
    }
};

// Helper function to get the override for a specific day, company, and location
exports.getWorkingDayOverride = async (date, employeeId) => {
    // We need employee company and location
    const emp = await Employee.findById(employeeId);
    if (!emp) return null;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const matchQuery = {
        fromDate: { $lte: targetDate },
        toDate: { $gte: targetDate },
        $or: [
            { company: null, location: null }, // Global override
            { company: emp.company, location: null }, // Company-specific
            { company: emp.company, location: emp.location } // Location-specific
        ]
    };

    // Sort by most specific first (assuming location > company > global) if multiple
    // Mongoose doesn't support complex sorting by specificity easily, so we just pick one 
    // or sort by createdAt desc if there are overlaps.
    const overrides = await WorkingDayOverride.find(matchQuery).sort({ createdAt: -1 }).limit(1);

    return overrides.length > 0 ? overrides[0] : null;
};

exports.calculateDailyAttendance = async (checkInDate, checkOutDate, employeeId) => {
    if (!checkInDate) return { status: 'Absent', lateMinutes: 0, overtimeHours: 0 };

    const settings = await getSettings();
    let status = 'Present';
    let lateMinutes = 0;
    let overtimeHours = 0;
    let holidayOvertimeHours = 0;

    const override = await exports.getWorkingDayOverride(checkInDate, employeeId);
    let expectedHours = override ? override.workingHours : (settings.expectedWorkingHours || 9);

    // Time calculations
    const checkIn = new Date(checkInDate);
    const officeStartArr = (settings.officeStartTime || '09:00').split(':');
    const expectedStartTime = new Date(checkIn);
    expectedStartTime.setHours(parseInt(officeStartArr[0]), parseInt(officeStartArr[1]), 0, 0);

    // If it's a Full Day Off due to override (e.g., Heavy Rain)
    if (override && override.type === 'Full Day Off') {
        // Any work done is overtime (only if OT is enabled)
        if (checkOutDate && settings.overtimeEnabled) {
            const checkOut = new Date(checkOutDate);
            const diffMs = checkOut - checkIn;
            const diffMins = Math.floor(diffMs / 60000);
            holidayOvertimeHours = parseFloat((diffMins / 60).toFixed(2));
        }
        return { status: 'Public Holiday', lateMinutes: 0, overtimeHours: 0, holidayOvertimeHours };
    }

    // Calculate Late Minutes (only if late marking is enabled)
    if (settings.lateMarkingEnabled && checkIn > expectedStartTime) {
        const diffMs = checkIn - expectedStartTime;
        const diffMins = Math.floor(diffMs / 60000);
        const graceMinutes = settings.lateGraceMinutes != null ? settings.lateGraceMinutes : 15;
        if (diffMins > graceMinutes) {
            lateMinutes = diffMins;
            status = 'Late';

            // Half day threshold
            const halfDayThreshold = settings.halfDayThresholdMinutes || (expectedHours * 60) / 2;
            if (lateMinutes > halfDayThreshold) {
                status = 'Half Day';
            }
        }
    }

    if (override && override.type === 'Half Day Off' && status === 'Half Day') {
        status = 'Present';
        lateMinutes = 0;
    }

    // Calculate OT (only if overtime is enabled and checkout exists)
    if (settings.overtimeEnabled && checkOutDate) {
        const checkOut = new Date(checkOutDate);

        const expectedEndTime = new Date(expectedStartTime);
        expectedEndTime.setHours(expectedEndTime.getHours() + expectedHours);

        if (checkOut > expectedEndTime) {
            const diffMs = checkOut - expectedEndTime;
            const diffMins = Math.floor(diffMs / 60000);
            const otMinMins = settings.otMinimumMinutes != null ? settings.otMinimumMinutes : 60;

            if (diffMins >= otMinMins) {
                overtimeHours = parseFloat((diffMins / 60).toFixed(2));
            }
        }
    }

    return { status, lateMinutes, overtimeHours, holidayOvertimeHours };
};

// Insert or update attendance 
exports.processAttendanceEntry = async (employeeId, date, checkIn, checkOut, source = 'Manual') => {
    // Normalize date to 00:00:00 local
    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const { status, lateMinutes, overtimeHours, holidayOvertimeHours } = await exports.calculateDailyAttendance(checkIn, checkOut, employeeId);

    const filter = { employee: employeeId, date: recordDate };
    const update = {
        checkIn,
        checkOut,
        status,
        lateMinutes,
        overtimeHours,
        holidayOvertimeHours,
        source
    };

    // Upsert
    const record = await Attendance.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        runValidators: true
    });

    return record;
};

// Build biometric status considering off-days and missing punches
exports.calculateBiometricStatus = async (checkInDate, checkOutDate, employeeId) => {
    if (!checkInDate) return { status: 'Absent', lateMinutes: 0, overtimeHours: 0 };

    const settings = await getSettings();
    let status = 'Present';
    let lateMinutes = 0;
    let overtimeHours = 0;
    let holidayOvertimeHours = 0;

    const override = await exports.getWorkingDayOverride(checkInDate, employeeId);
    let expectedHours = override ? override.workingHours : (settings.expectedWorkingHours || 9);

    const checkIn = new Date(checkInDate);
    // Determine Weekend
    const dayOfWeek = checkIn.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = 'Weekend';
    }

    if (override && override.type === 'Full Day Off') {
        status = 'Public Holiday';
    }

    if (status !== 'Weekend' && status !== 'Public Holiday') {
        const officeStartArr = (settings.officeStartTime || '09:00').split(':');
        const expectedStartTime = new Date(checkIn);
        expectedStartTime.setHours(parseInt(officeStartArr[0]), parseInt(officeStartArr[1]), 0, 0);

        // Calculate late only if enabled
        if (settings.lateMarkingEnabled && checkIn > expectedStartTime) {
            const diffMs = checkIn - expectedStartTime;
            const diffMins = Math.floor(diffMs / 60000);
            const graceMinutes = settings.lateGraceMinutes != null ? settings.lateGraceMinutes : 15;
            if (diffMins > graceMinutes) {
                lateMinutes = diffMins;
                status = 'Late';
                const halfDayThreshold = settings.halfDayThresholdMinutes || (expectedHours * 60) / 2;
                if (lateMinutes > halfDayThreshold) status = 'Half Day';
            }
        }
    }

    if (checkOutDate) {
        const checkOut = new Date(checkOutDate);

        const officeStartArr = (settings.officeStartTime || '09:00').split(':');
        const expectedStartTime = new Date(checkOut);
        expectedStartTime.setHours(parseInt(officeStartArr[0]), parseInt(officeStartArr[1]), 0, 0);

        const expectedEndTime = new Date(expectedStartTime);
        expectedEndTime.setHours(expectedEndTime.getHours() + expectedHours);

        // Calculate OT only if enabled
        if (settings.overtimeEnabled) {
            if (checkOut > expectedEndTime || status === 'Weekend' || status === 'Public Holiday') {
                const baseTime = (status === 'Weekend' || status === 'Public Holiday') ? checkIn : expectedEndTime;
                if (checkOut > baseTime) {
                    const diffMs = checkOut - baseTime;
                    const diffMins = Math.floor(diffMs / 60000);
                    const otMinMins = settings.otMinimumMinutes != null ? settings.otMinimumMinutes : 60;

                    if (diffMins >= otMinMins) {
                        if (status === 'Weekend' || status === 'Public Holiday') {
                            holidayOvertimeHours = parseFloat((diffMins / 60).toFixed(2));
                        } else {
                            overtimeHours = parseFloat((diffMins / 60).toFixed(2));
                        }
                    }
                }
            }
        }
    }

    return { status, lateMinutes, overtimeHours, holidayOvertimeHours };
};

// Process Biometric Punches
exports.processBiometricPunch = async (employeeId, type, location, photoPath, faceMatchScore, faceMatchFailed) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    let record = await Attendance.findOne({ employee: employeeId, date: { $gte: today, $lte: endOfDay } });
    const now = new Date();

    if (!record) {
        if (type === 'out') {
            throw new Error('Cannot punch out without punching in first.');
        }

        const { status, lateMinutes } = await exports.calculateBiometricStatus(now, null, employeeId);

        record = new Attendance({
            employee: employeeId,
            date: today,
            checkIn: now,
            status,
            lateMinutes,
            source: 'Biometric',
            punchInLocation: location,
            punchInPhoto: photoPath,
            faceMatchScore,
            faceMatchFailed,
            approvalStatus: 'Pending Manager'
        });
        await record.save();
        return record;
    }

    if (record.isLocked) {
        throw new Error('Attendance for this date is already locked.');
    }

    if (type === 'in') {
        throw new Error('You have already punched in today.');
    }

    if (type === 'out') {
        if (record.checkOut) {
            throw new Error('You have already punched out today.');
        }

        const { status, lateMinutes, overtimeHours, holidayOvertimeHours } = await exports.calculateBiometricStatus(record.checkIn, now, employeeId);

        record.checkOut = now;
        record.status = status; // Retain late/weekend status or update
        record.lateMinutes = lateMinutes;
        record.overtimeHours = overtimeHours;
        record.holidayOvertimeHours = holidayOvertimeHours;
        record.punchOutLocation = location;
        record.punchOutPhoto = photoPath;
        // Update face match stats with punch out
        if (faceMatchScore !== undefined) record.faceMatchScore = faceMatchScore;
        if (faceMatchFailed !== undefined) record.faceMatchFailed = faceMatchFailed;

        // Require manager re-approval if punch out involves overtime or flags
        record.approvalStatus = 'Pending Manager';

        await record.save();
    }

    return record;
};

// Periodic Cron or End of Day script can check for missing punch-out
exports.flagMissingPunchOuts = async (date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await Attendance.updateMany(
        { date: { $gte: targetDate, $lte: endOfDay }, checkIn: { $ne: null }, checkOut: null },
        { $set: { status: 'Missing Punch Out', approvalStatus: 'Pending Manager' } }
    );
    return result.modifiedCount;
};

// Lock attendance for a specific month for payroll
exports.lockMonthAttendance = async (year, month) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await Attendance.updateMany(
        { date: { $gte: startDate, $lte: endDate } },
        { $set: { isLocked: true } }
    );
    return result.modifiedCount;
};
