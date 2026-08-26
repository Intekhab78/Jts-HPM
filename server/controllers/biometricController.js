const biometricService = require('../services/biometricService');
const BiometricLog = require('../models/BiometricLog');
const Employee = require('../models/Employee');

/**
 * @desc    Get biometric logs list (with pagination, filtering & search)
 * @route   GET /api/biometric/logs
 * @access  Private (HR/Admin)
 */
exports.getLogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, status, deviceBrand, startDate, endDate, search } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        if (deviceBrand) {
            query.deviceBrand = deviceBrand;
        }

        if (startDate && endDate) {
            query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // Search by biometricId or employee name
        if (search) {
            // Find employees matching search term
            const matchedEmployees = await Employee.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { employeeId: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const empIds = matchedEmployees.map(e => e._id);
            
            query.$or = [
                { biometricId: { $regex: search, $options: 'i' } },
                { employee: { $in: empIds } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const count = await BiometricLog.countDocuments(query);
        
        const logs = await BiometricLog.find(query)
            .populate('employee', 'firstName lastName employeeId department')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            },
            data: logs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Ingest logs from generic device / API client
 * @route   POST /api/biometric/logs
 * @access  Private (Admin/HR/API Client)
 */
exports.pushLogs = async (req, res, next) => {
    try {
        const logs = Array.isArray(req.body) ? req.body : [req.body];
        
        if (logs.length === 0) {
            return res.status(400).json({ success: false, message: 'Request body cannot be empty' });
        }

        // Validate basic properties
        for (const log of logs) {
            if (!log.biometricId || !log.timestamp) {
                return res.status(400).json({
                    success: false,
                    message: 'Each log entry must contain biometricId and timestamp'
                });
            }
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const normalizedLogs = logs.map(l => ({
            biometricId: String(l.biometricId).trim(),
            timestamp: l.timestamp,
            deviceBrand: l.deviceBrand || 'Generic',
            deviceName: l.deviceName || 'Generic API Client',
            deviceIp: ip,
            type: l.type || 'Punch',
            rawPayload: l
        }));

        const results = await biometricService.ingestLogs(normalizedLogs);
        
        const processedCount = results.filter(r => r.status === 'Processed').length;
        res.status(201).json({
            success: true,
            message: `Ingested ${results.length} logs. Processed: ${processedCount}, Failed: ${results.length - processedCount}`,
            data: results
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Hikvision event webhook receiver
 * @route   POST /api/biometric/hikvision
 * @access  Public (webhook, device authenticated by source IP or secret if desired)
 */
exports.hikvisionWebhook = async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Return 200 OK early to Hikvision device to keep webhook alive
        res.status(200).json({ success: true, message: 'Event received' });
        
        // Process asynchronously
        await biometricService.parseHikvisionData(req.body, ip);
    } catch (error) {
        console.error('Hikvision Webhook Error:', error.message);
        // Do not call next() since we already sent headers
    }
};

/**
 * @desc    ZKTeco ADMS device handshake (GET options)
 * @route   GET /iclock/cdata
 * @access  Public
 */
exports.zkHandshake = async (req, res, next) => {
    try {
        const SN = req.query.SN || 'Unknown';
        console.log(`ZKTeco Handshake request from SN: ${SN}`);
        
        res.setHeader('Content-Type', 'text/plain');
        // Standard ADMS parameters
        // delay check commands: Delay = 30 seconds
        // real time check interval: TransInterval = 10 seconds
        // timezone offset: TimeZone = 4 (UAE +04:00)
        res.send(`GET OPTION FROM: 1\nStamp=1\nOpStamp=1\nErrorDelay=30\nDelay=10\nTransInterval=5\nTransFlag=1000000000\nTimeZone=4\nRealtime=1\n`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    ZKTeco ADMS fetch commands
 * @route   GET /iclock/getrequest
 * @access  Public
 */
exports.zkGetRequest = async (req, res, next) => {
    try {
        // Devices poll this to get actions from server (like register card, sync user, etc.)
        // We just return "OK" which means no pending commands
        res.setHeader('Content-Type', 'text/plain');
        res.send('OK');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    ZKTeco ADMS upload log data
 * @route   POST /iclock/cdata
 * @access  Public
 */
exports.zkPostData = async (req, res, next) => {
    try {
        const SN = req.query.SN || 'Unknown';
        const table = req.query.table || '';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // If it's a POST payload with attendance logs
        if (table.toUpperCase() === 'ATTLOG') {
            const rawBody = req.body;
            if (typeof rawBody === 'string') {
                await biometricService.parseZKData(rawBody, req.query, ip);
            } else {
                console.error('Expected text body from ZK device, got:', typeof rawBody);
            }
        } else {
            console.log(`ZKTeco POST metadata table=${table} from SN: ${SN}`);
        }

        res.setHeader('Content-Type', 'text/plain');
        res.send('OK');
    } catch (error) {
        console.error('ZKTeco POST Data Error:', error.message);
        res.setHeader('Content-Type', 'text/plain');
        res.status(500).send('ERROR');
    }
};

/**
 * @desc    Force reprocess a failed log entry
 * @route   POST /api/biometric/logs/:id/reprocess
 * @access  Private (Admin/HR)
 */
exports.reprocessLog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await biometricService.processLogEntry(id);
        
        if (result.status === 'Failed') {
            return res.status(400).json({
                success: false,
                message: `Reprocessing failed: ${result.errorMessage}`,
                data: result
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Biometric log reprocessed successfully and mapped to attendance.',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Hik-Connect Cloud OpenAPI Event webhook receiver
 * @route   POST /api/biometric/hik-connect
 * @access  Public
 */
exports.hikConnectWebhook = async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Acknowledge receipt to Hik-Connect Cloud
        res.status(200).json({ success: true, message: 'Message received' });
        
        // Process asynchronously
        await biometricService.parseHikConnectCloudData(req.body, ip);
    } catch (error) {
        console.error('Hik-Connect Webhook Error:', error.message);
    }
};

/**
 * @desc    iVMS / HikCentral Server Web API Callback receiver
 * @route   POST /api/biometric/ivms
 * @access  Public
 */
exports.ivmsWebhook = async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Acknowledge receipt to iVMS/HikCentral Server
        res.status(200).json({ success: true, message: 'Callback received' });
        
        // Process asynchronously
        await biometricService.parseIVMSData(req.body, ip);
    } catch (error) {
        console.error('iVMS Callback Error:', error.message);
    }
};
