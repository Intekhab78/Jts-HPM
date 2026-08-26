const Attendance = require('../models/Attendance');
const WorkingDayOverride = require('../models/WorkingDayOverride');
const Employee = require('../models/Employee');

// Default Office Hours: 09:00 AM to 06:00 PM (9 hours including 1 hour break)
const OFFICE_START_TIME = '09:00';
const OFFICE_END_TIME = '18:00';
const LATE_GRACE_MINUTES = 15; // 15 mins grace period
const OT_MINIMUM_MINUTES = 60; // minimum 1 hr OT to qualify

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

    let status = 'Present';
    let lateMinutes = 0;
    let overtimeHours = 0;
    let holidayOvertimeHours = 0;

    const override = await exports.getWorkingDayOverride(checkInDate, employeeId);
    let expectedHours = override ? override.workingHours : 9;

    // Time calculations
    const checkIn = new Date(checkInDate);
    const officeStartArr = OFFICE_START_TIME.split(':');
    const expectedStartTime = new Date(checkIn);
    expectedStartTime.setHours(parseInt(officeStartArr[0]), parseInt(officeStartArr[1]), 0, 0);

    // If it's a Full Day Off due to override (e.g., Heavy Rain)
    if (override && override.type === 'Full Day Off') {
        // Any work done is overtime
        if (checkOutDate) {
            const checkOut = new Date(checkOutDate);
            const diffMs = checkOut - checkIn;
            const diffMins = Math.floor(diffMs / 60000);
            holidayOvertimeHours = parseFloat((diffMins / 60).toFixed(2));
        }
        return { status: 'Public Holiday', lateMinutes: 0, overtimeHours: 0, holidayOvertimeHours };
    }

    // Calculate Late Minutes
    if (checkIn > expectedStartTime) {
        const diffMs = checkIn - expectedStartTime;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins > LATE_GRACE_MINUTES) {
            lateMinutes = diffMins;
            status = 'Late';

            // If more than half the expected hours late, mark as half day.
            if (lateMinutes > (expectedHours * 60) / 2) {
                status = 'Half Day';
            }
        }
    }

    if (override && override.type === 'Half Day Off' && status === 'Half Day') {
        // If they were supposed to get a half day off, and they missed half a day, they might be fully present for their required shortened shift.
        // (Implementation logic for half day off can vary. Assuming if they worked the required half, they are present).
        status = 'Present';
        lateMinutes = 0; // Reset late if it fell into the off period, complex to handle perfectly without shift start/end specifics.
    }

    // Calculate OT (if checkout exists)
    if (checkOutDate) {
        const checkOut = new Date(checkOutDate);

        // Dynamic End Time based on expected hours
        const expectedEndTime = new Date(expectedStartTime);
        expectedEndTime.setHours(expectedEndTime.getHours() + expectedHours);

        if (checkOut > expectedEndTime) {
            const diffMs = checkOut - expectedEndTime;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins >= OT_MINIMUM_MINUTES) {
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

    let status = 'Present';
    let lateMinutes = 0;
    let overtimeHours = 0;
    let holidayOvertimeHours = 0;

    const override = await exports.getWorkingDayOverride(checkInDate, employeeId);
    let expectedHours = override ? override.workingHours : 9;

    const checkIn = new Date(checkInDate);
    // Determine Weekend
    const dayOfWeek = checkIn.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // 0 = Sunday, 6 = Saturday
        status = 'Weekend';
    }

    if (override && override.type === 'Full Day Off') {
        status = 'Public Holiday';
    }

    if (status !== 'Weekend' && status !== 'Public Holiday') {
        const officeStartArr = OFFICE_START_TIME.split(':');
        const expectedStartTime = new Date(checkIn);
        expectedStartTime.setHours(parseInt(officeStartArr[0]), parseInt(officeStartArr[1]), 0, 0);

        if (checkIn > expectedStartTime) {
            const diffMs = checkIn - expectedStartTime;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins > LATE_GRACE_MINUTES) {
                lateMinutes = diffMins;
                status = 'Late';
                if (lateMinutes > (expectedHours * 60) / 2) status = 'Half Day';
            }
        }
    }

    if (checkOutDate) {
        const checkOut = new Date(checkOutDate);

        // Dynamic End Time based on expected hours from 09:00 AM
        const officeStartArr = OFFICE_START_TIME.split(':');
        const expectedStartTime = new Date(checkOut);
        expectedStartTime.setHours(parseInt(officeStartArr[0]), parseInt(officeStartArr[1]), 0, 0);

        const expectedEndTime = new Date(expectedStartTime);
        expectedEndTime.setHours(expectedEndTime.getHours() + expectedHours);

        if (checkOut > expectedEndTime || status === 'Weekend' || status === 'Public Holiday') {
            const baseTime = (status === 'Weekend' || status === 'Public Holiday') ? checkIn : expectedEndTime;
            // Ensure we don't calculate negative diff if they left early on a weekend (though shouldn't happen)
            if (checkOut > baseTime) {
                const diffMs = checkOut - baseTime;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins >= OT_MINIMUM_MINUTES) {
                    if (status === 'Weekend' || status === 'Public Holiday') {
                        holidayOvertimeHours = parseFloat((diffMins / 60).toFixed(2));
                    } else {
                        overtimeHours = parseFloat((diffMins / 60).toFixed(2));
                    }
                }
            }
        }
    }

    return { status, lateMinutes, overtimeHours, holidayOvertimeHours };
};

// Process Biometric Punches
exports.processBiometricPunch = async (employeeId, type, location, photoPath, faceMatchScore, faceMatchFailed) => {
    // Geo-Fencing Validation
    const emp = await Employee.findById(employeeId)
        .populate('company')
        .populate('geoFencing.allowedFences.location');
        
    if (!emp) {
        throw new Error('Employee not found');
    }

    let outsideGeofence = false;
    let geoFenceWarningText = '';

    if (emp.geoFencing && emp.geoFencing.enabled) {
        if (!location || location.lat === undefined || location.lng === undefined) {
            throw new Error('Location coordinates are required for geo-fenced punches.');
        }

        const fences = emp.geoFencing.allowedFences || [];
        
        if (fences.length > 0) {
            let insideAnyFence = false;
            let checkSummary = [];

            for (const fence of fences) {
                let targetLat, targetLng, targetRadius;

                if (fence.fenceType === 'LocationMaster') {
                    const loc = fence.location;
                    if (!loc || loc.lat === undefined || loc.lng === undefined) {
                        continue; // Skip if branch location doesn't have GPS coordinates set up
                    }
                    targetLat = loc.lat;
                    targetLng = loc.lng;
                    targetRadius = loc.radius || 100;
                } else {
                    // Custom map GPS coordinates
                    targetLat = fence.lat;
                    targetLng = fence.lng;
                    targetRadius = fence.radius || 100;
                }

                if (targetLat !== undefined && targetLng !== undefined) {
                    const dist = getDistanceInMeters(
                        location.lat,
                        location.lng,
                        targetLat,
                        targetLng
                    );

                    checkSummary.push({
                        name: fence.fenceType === 'LocationMaster' ? (fence.location?.name || 'Branch') : (fence.name || 'Custom GPS'),
                        distance: Math.round(dist),
                        radius: targetRadius
                    });

                    if (dist <= targetRadius) {
                        insideAnyFence = true;
                        break;
                    }
                }
            }

            if (!insideAnyFence) {
                // Check company override
                const companyAllowPunch = emp.company && emp.company.allowPunchOutsideGeofence;
                const companyOpenAttendance = emp.company && emp.company.allowOpenAttendance;

                if (companyAllowPunch) {
                    outsideGeofence = false;
                } else if (companyOpenAttendance) {
                    outsideGeofence = true;
                    const details = checkSummary.map(s => `${s.name}: ${s.distance}m`).join(', ');
                    geoFenceWarningText = `Outside Authorized Geo-Fence Boundary (${details || 'No coordinates configured'})`;
                } else {
                    const details = checkSummary.map(s => `${s.name}: ${s.distance}m (limit: ${s.radius}m)`).join(', ');
                    throw new Error(`Punch rejected: You are outside all allowed geo-fence areas. (${details || 'No active coordinates configured'})`);
                }
            }
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let record = await Attendance.findOne({ employee: employeeId, date: today });
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
            approvalStatus: outsideGeofence ? 'Pending Manager' : 'Auto-Approved',
            geoFenceWarning: outsideGeofence ? geoFenceWarningText : undefined
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

        // Require manager re-approval if punch was outside geo-fence
        if (outsideGeofence) {
            record.approvalStatus = 'Pending Manager';
            record.geoFenceWarning = record.geoFenceWarning 
                ? `${record.geoFenceWarning} | Out-Out: ${geoFenceWarningText}` 
                : geoFenceWarningText;
        } else if (record.approvalStatus !== 'Auto-Approved') {
            // Keep it Pending Manager / Pending HR if it was already pending (e.g. because check-in was outside)
        } else {
            // Punches inside and check-in inside is kept as Auto-Approved
            record.approvalStatus = 'Auto-Approved';
        }

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

// Helper: Calculate distance in meters using Haversine formula
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
exports.getDistanceInMeters = getDistanceInMeters;

// Process biometric device log (Hikvision, ZK ADMS, Amico, etc.)
exports.processBiometricLog = async (employeeId, timestamp, type = 'Punch', deviceBrand = 'Generic') => {
    const punchTime = new Date(timestamp);
    const recordDate = new Date(punchTime);
    recordDate.setHours(0, 0, 0, 0);

    let record = await Attendance.findOne({ employee: employeeId, date: recordDate });

    if (!record) {
        // If there's no record, we treat this punch as checkIn
        const { status, lateMinutes } = await exports.calculateBiometricStatus(punchTime, null, employeeId);
        
        record = new Attendance({
            employee: employeeId,
            date: recordDate,
            checkIn: punchTime,
            status,
            lateMinutes,
            source: 'Biometric',
            approvalStatus: 'Auto-Approved'
        });
    } else {
        if (record.isLocked) {
            throw new Error('Attendance for this date is already locked.');
        }

        let updateNeeded = false;
        
        if (!record.checkIn) {
            record.checkIn = punchTime;
            updateNeeded = true;
        } else if (punchTime < record.checkIn) {
            if (!record.checkOut || record.checkIn > record.checkOut) {
                record.checkOut = record.checkIn;
            }
            record.checkIn = punchTime;
            updateNeeded = true;
        } else if (!record.checkOut || punchTime > record.checkOut) {
            record.checkOut = punchTime;
            updateNeeded = true;
        }

        if (updateNeeded) {
            const { status, lateMinutes, overtimeHours, holidayOvertimeHours } = 
                await exports.calculateBiometricStatus(record.checkIn, record.checkOut, employeeId);
            
            record.status = status;
            record.lateMinutes = lateMinutes;
            record.overtimeHours = overtimeHours;
            record.holidayOvertimeHours = holidayOvertimeHours;
            record.source = 'Biometric';
        }
    }

    await record.save();
    return record;
};
