const BiometricLog = require('../models/BiometricLog');
const Employee = require('../models/Employee');
const attendanceService = require('./attendanceService');

/**
 * Core function to process a single log entry and map it to an Employee/Attendance
 */
exports.processLogEntry = async (logId) => {
    const log = await BiometricLog.findById(logId);
    if (!log) throw new Error('Biometric log not found');

    try {
        // Find employee mapping.
        // We look for an employee who has this biometricId mapped.
        const employee = await Employee.findOne({
            'biometricMappings.biometricId': log.biometricId
        });

        if (!employee) {
            log.status = 'Failed';
            log.errorMessage = `No employee mapped to Biometric ID: ${log.biometricId}`;
            await log.save();
            return log;
        }

        // Link log to employee
        log.employee = employee._id;

        // Process punch inside attendance records
        await attendanceService.processBiometricLog(
            employee._id,
            log.timestamp,
            log.type,
            log.deviceBrand
        );

        log.status = 'Processed';
        log.errorMessage = undefined;
        await log.save();
        return log;
    } catch (err) {
        log.status = 'Failed';
        log.errorMessage = err.message;
        await log.save();
        return log;
    }
};

/**
 * Ingest and process a list of raw punches
 */
exports.ingestLogs = async (punches) => {
    const results = [];
    for (const punch of punches) {
        const { biometricId, timestamp, deviceBrand, deviceName, deviceIp, type, rawPayload } = punch;
        
        // Create raw log
        const log = new BiometricLog({
            biometricId: String(biometricId).trim(),
            timestamp: new Date(timestamp),
            deviceBrand: deviceBrand || 'Generic',
            deviceName: deviceName,
            deviceIp: deviceIp,
            type: type || 'Punch',
            rawPayload: rawPayload,
            status: 'Pending'
        });
        
        await log.save();
        
        // Process it synchronously or trigger in background
        const processedLog = await exports.processLogEntry(log._id);
        results.push(processedLog);
    }
    return results;
};

/**
 * Parser for ZKTeco ADMS format
 * ZKTeco pushes text/plain tab-separated lines containing punches
 * Example line: 1001\t2026-08-24 11:15:30\t0\t1\t0\t0
 * Columns: PIN (biometricId), Timestamp, Status/Direction, VerifyType, Workcode
 */
exports.parseZKData = async (textData, queryParams, ipAddress) => {
    const lines = textData.split(/\r?\n/);
    const punches = [];
    const SN = queryParams.SN || 'ZK_Device';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Split by tabs or spaces
        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) continue;

        const biometricId = parts[0];
        const timeStr = parts[1] + ' ' + (parts[2] || '00:00:00');
        const directionNum = parts[3]; // Status: 0=Check-In, 1=Check-Out, 2=Break-Out...

        // Map ZK direction to standard type
        let type = 'Punch';
        if (directionNum === '0') type = 'Check-In';
        if (directionNum === '1') type = 'Check-Out';

        punches.push({
            biometricId,
            timestamp: new Date(timeStr.replace(/-/g, '/')), // replacement safe for ISO format
            deviceBrand: 'ZKTeco',
            deviceName: `SN: ${SN}`,
            deviceIp: ipAddress,
            type,
            rawPayload: { line, queryParams }
        });
    }

    return await exports.ingestLogs(punches);
};

/**
 * Parser for Hikvision Access Event JSON Webhook
 */
exports.parseHikvisionData = async (payload, ipAddress) => {
    const punches = [];
    
    // Standard Hikvision / Hik-Connect event payload structure
    const event = payload.AccessControlEvent || payload.event || {};
    
    // Extract biometricId from various possible keys
    const biometricId = event.employeeNoString || payload.employeeNoString ||
                        event.employeeNo || payload.employeeNo ||
                        event.personId || payload.personId ||
                        event.personNo || payload.personNo ||
                        payload.userId || payload.ID || payload.id;
                        
    // Extract timestamp from various possible keys
    const dateTime = payload.dateTime || payload.eventTime || event.dateTime ||
                     payload.time || event.time || 
                     payload.occurTime || event.occurTime;
                     
    const deviceName = event.deviceName || payload.deviceName || 
                       payload.deviceSerialNo || event.deviceSerialNo || 'Hikvision Device';
    
    if (biometricId && dateTime) {
        // Map Hikvision status if available
        let type = 'Punch';
        const rawStatus = event.attendanceStatus || payload.attendanceStatus || payload.direction;
        if (rawStatus === 'checkIn' || rawStatus === 'in' || rawStatus === '0') type = 'Check-In';
        if (rawStatus === 'checkOut' || rawStatus === 'out' || rawStatus === '1') type = 'Check-Out';

        punches.push({
            biometricId: String(biometricId).trim(),
            timestamp: new Date(dateTime),
            deviceBrand: 'Hikvision',
            deviceName,
            deviceIp: ipAddress,
            type,
            rawPayload: payload
        });
    } else {
        throw new Error('Missing employeeNoString or dateTime in Hikvision payload');
    }

    return await exports.ingestLogs(punches);
};

/**
 * Parser for Hik-Connect Cloud OpenAPI Event notifications
 * Emitted when any device in the Hik-Connect Cloud account registers a card/face authentication.
 */
exports.parseHikConnectCloudData = async (payload, ipAddress) => {
    const punches = [];
    
    // Hik-Connect OpenAPI wraps events under message envelope: msg -> msgBody
    const msg = payload.msg || {};
    const body = msg.msgBody || payload; // Fallback to root if already unwrapped
    
    const biometricId = body.personId || body.employeeNo || body.employeeNoString || body.cardNo;
    const eventTime = body.eventTime || body.time || body.occurTime || msg.msgHeader?.sendTime;
    const deviceName = body.deviceName || 'Hik-Connect Cloud';
    const deviceSerial = body.deviceSerial || 'Unknown';
    
    if (biometricId && eventTime) {
        let type = 'Punch';
        const direction = body.direction || body.attendanceStatus;
        if (direction === 'in' || direction === 'checkIn' || direction === '0') type = 'Check-In';
        if (direction === 'out' || direction === 'checkOut' || direction === '1') type = 'Check-Out';

        punches.push({
            biometricId: String(biometricId).trim(),
            timestamp: new Date(eventTime),
            deviceBrand: 'Hikvision',
            deviceName: `${deviceName} (Cloud: ${deviceSerial})`,
            deviceIp: ipAddress,
            type,
            rawPayload: payload
        });
    } else {
        throw new Error('Missing personId/employeeNo or eventTime in Hik-Connect Cloud payload');
    }

    return await exports.ingestLogs(punches);
};

/**
 * Parser for local iVMS / HikCentral Server Web API Callback events
 * Emitted by centralized on-premise servers forwarding device logs over Web API callbacks.
 */
exports.parseIVMSData = async (payload, ipAddress) => {
    const punches = [];
    
    // iVMS/HikCentral sends flattened or nested structured JSON alerts
    const biometricId = payload.employeeNo || payload.personId || payload.employeeNoString || payload.userId;
    const eventTime = payload.eventTime || payload.dateTime || payload.occurTime;
    const deviceName = payload.srcName || payload.deviceName || 'iVMS Server';
    const deviceSerial = payload.srcIndex || payload.deviceSerialNo || 'Unknown';
    
    if (biometricId && eventTime) {
        let type = 'Punch';
        const direction = payload.direction || payload.attendanceStatus;
        if (direction === 'in' || direction === 'checkIn' || direction === '0') type = 'Check-In';
        if (direction === 'out' || direction === 'checkOut' || direction === '1') type = 'Check-Out';

        punches.push({
            biometricId: String(biometricId).trim(),
            timestamp: new Date(eventTime),
            deviceBrand: 'Hikvision',
            deviceName: `${deviceName} (iVMS SN: ${deviceSerial})`,
            deviceIp: ipAddress,
            type,
            rawPayload: payload
        });
    } else {
        throw new Error('Missing employeeNo or eventTime in iVMS callback payload');
    }

    return await exports.ingestLogs(punches);
};
