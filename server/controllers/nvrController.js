const Device = require('../models/Device');
const SecurityAlert = require('../models/SecurityAlert');
const Employee = require('../models/Employee');
const VideoRecording = require('../models/VideoRecording');
const faceServiceManager = require('../services/faceServiceManager');
const path = require('path');
const fs = require('fs');

// @desc    Get all NVR camera channels with live status and active alert statistics
// @route   GET /api/nvr/channels
// @access  Private (Admin/HR/Security)
exports.getChannels = async (req, res, next) => {
    try {
        const devices = await Device.find({ deviceType: 'IPCamera' })
            .populate('company', 'name')
            .populate('location', 'name')
            .populate('securityMonitoring.notifyEmployees', 'firstName lastName employeeId email profilePhoto');

        // Fetch live statuses from Python microservice
        const channels = await Promise.all(devices.map(async (dev) => {
            let liveStatus = {
                isRunning: false,
                status: 'offline',
                error: null,
                width: 0,
                height: 0,
                isRecording: false,
                recordingElapsedSecs: 0,
                totalPunches: 0,
                visitorCount: 0
            };

            try {
                const pyRes = await fetch(`http://127.0.0.1:5001/ip-camera/status/${dev._id}`);
                if (pyRes.ok) {
                    const data = await pyRes.json();
                    liveStatus = { ...liveStatus, ...data };
                }
            } catch (e) {
                // Ignore silent status error
            }

            // Count active unresolved security alerts for this camera
            const activeAlertsCount = await SecurityAlert.countDocuments({
                device: dev._id,
                status: { $in: ['Active', 'Escalated'] }
            });

            return {
                ...dev.toObject(),
                liveStatus,
                activeAlertsCount
            };
        }));

        const totalActiveAlerts = await SecurityAlert.countDocuments({ status: { $in: ['Active', 'Escalated'] } });
        const totalRecordings = await VideoRecording.countDocuments();

        res.status(200).json({
            success: true,
            count: channels.length,
            summary: {
                totalCameras: channels.length,
                onlineCameras: channels.filter(c => c.liveStatus.isRunning).length,
                recordingCameras: channels.filter(c => c.liveStatus.isRecording).length,
                activeAlerts: totalActiveAlerts,
                totalSurveillanceClips: totalRecordings
            },
            data: channels
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update camera role (FaceRecognition, SecuritySurveillance, Hybrid, RestrictedArea) and alert rules
// @route   PUT /api/nvr/channels/:id/role
// @access  Private (Admin/HR/Security)
exports.updateChannelRole = async (req, res, next) => {
    try {
        const {
            cameraRole,
            enableTwoWayAudio,
            securityMonitoring,
            zoneGroup,
            direction,
            cooldownMinutes
        } = req.body;

        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Camera channel not found' });
        }

        if (cameraRole) device.cameraRole = cameraRole;
        if (enableTwoWayAudio !== undefined) device.enableTwoWayAudio = enableTwoWayAudio;
        if (zoneGroup) device.zoneGroup = zoneGroup;
        if (direction) device.direction = direction;
        if (cooldownMinutes !== undefined) device.cooldownMinutes = Number(cooldownMinutes);

        if (securityMonitoring) {
            device.securityMonitoring = {
                alertUnrecognizedFaces: securityMonitoring.alertUnrecognizedFaces !== undefined ? securityMonitoring.alertUnrecognizedFaces : device.securityMonitoring?.alertUnrecognizedFaces,
                alertAfterHours: securityMonitoring.alertAfterHours !== undefined ? securityMonitoring.alertAfterHours : device.securityMonitoring?.alertAfterHours,
                afterHoursStart: securityMonitoring.afterHoursStart || device.securityMonitoring?.afterHoursStart || '20:00',
                afterHoursEnd: securityMonitoring.afterHoursEnd || device.securityMonitoring?.afterHoursEnd || '06:00',
                alertBlacklist: securityMonitoring.alertBlacklist !== undefined ? securityMonitoring.alertBlacklist : device.securityMonitoring?.alertBlacklist,
                alertCameraOffline: securityMonitoring.alertCameraOffline !== undefined ? securityMonitoring.alertCameraOffline : device.securityMonitoring?.alertCameraOffline,
                notifyEmails: securityMonitoring.notifyEmails || device.securityMonitoring?.notifyEmails || [],
                notifyEmployees: securityMonitoring.notifyEmployees || device.securityMonitoring?.notifyEmployees || []
            };
        }

        await device.save();
        res.status(200).json({ success: true, message: 'Camera role & security rules updated', data: device });
    } catch (error) {
        next(error);
    }
};

// @desc    Broadcast two-way intercom audio (TTS text, audio base64, or siren alert) to camera speakers
// @route   POST /api/nvr/channels/:id/broadcast
// @access  Private (Admin/HR/Security)
exports.broadcastAudio = async (req, res, next) => {
    try {
        const {
            message,
            cue = 'normal', // 'normal' | 'siren' | 'warning' | 'restricted' | 'welcome'
            audioBase64
        } = req.body;

        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Camera device not found' });
        }

        await faceServiceManager.ensureRunning();

        // Dispatch broadcast to Python audio worker
        const pyRes = await fetch('http://127.0.0.1:5001/ip-camera/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: device._id.toString(),
                message: message || '',
                cue,
                audioBase64: audioBase64 || null
            })
        });

        const data = await pyRes.json();
        res.status(200).json({
            success: true,
            message: data.message || `Audio broadcast dispatched to ${device.description}`,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get security events and alerts with filtering & pagination
// @route   GET /api/nvr/alerts
// @access  Private (Admin/HR/Security)
exports.getSecurityAlerts = async (req, res, next) => {
    try {
        const {
            deviceId,
            severity,
            status,
            eventType,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 30
        } = req.query;

        const query = {};

        if (deviceId) query.device = deviceId;
        if (severity && severity !== 'ALL') query.severity = severity;
        if (status && status !== 'ALL') query.status = status;
        if (eventType && eventType !== 'ALL') query.eventType = eventType;

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                query.timestamp.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                query.timestamp.$lte = e;
            }
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { cameraName: { $regex: search, $options: 'i' } },
                { personName: { $regex: search, $options: 'i' } },
                { zoneGroup: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await SecurityAlert.countDocuments(query);
        const alerts = await SecurityAlert.find(query)
            .populate('device', 'description brand model')
            .populate('location', 'name')
            .populate('employeeRef', 'firstName lastName employeeId profilePhoto')
            .populate('resolvedBy', 'name email')
            .populate('notifiedEmployees', 'firstName lastName employeeId email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Quick KPI statistics
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await SecurityAlert.countDocuments({ timestamp: { $gte: todayStart } });
        const activeCount = await SecurityAlert.countDocuments({ status: 'Active' });
        const criticalCount = await SecurityAlert.countDocuments({ severity: 'Critical', status: { $in: ['Active', 'Escalated'] } });

        res.status(200).json({
            success: true,
            count: alerts.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            summary: {
                totalAlerts: total,
                todayAlerts: todayCount,
                activeUnresolved: activeCount,
                criticalActive: criticalCount
            },
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Acknowledge, escalate, or resolve a security alert
// @route   PUT /api/nvr/alerts/:id/resolve
// @access  Private (Admin/HR/Security)
exports.resolveSecurityAlert = async (req, res, next) => {
    try {
        const { status = 'Resolved', resolutionNotes, escalateToEmployeeId } = req.body;

        const alert = await SecurityAlert.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ success: false, message: 'Security alert not found' });
        }

        alert.status = status;
        alert.resolvedBy = req.user?._id;
        alert.resolvedAt = new Date();
        if (resolutionNotes) alert.resolutionNotes = resolutionNotes;

        if (status === 'Escalated' && escalateToEmployeeId) {
            const emp = await Employee.findById(escalateToEmployeeId);
            if (emp && !alert.notifiedEmployees.includes(emp._id)) {
                alert.notifiedEmployees.push(emp._id);
            }
        }

        await alert.save();
        res.status(200).json({ success: true, message: `Alert updated to ${status}`, data: alert });
    } catch (error) {
        next(error);
    }
};

// @desc    Trigger manual security alarm on a camera channel
// @route   POST /api/nvr/alerts/manual
// @access  Private (Admin/HR/Security)
exports.triggerManualAlert = async (req, res, next) => {
    try {
        const { deviceId, title, description, severity = 'High' } = req.body;

        const device = await Device.findById(deviceId).populate('location').populate('company');
        if (!device) {
            return res.status(404).json({ success: false, message: 'Camera device not found' });
        }

        const alert = await SecurityAlert.create({
            device: device._id,
            company: device.company?._id || device.company,
            location: device.location?._id || device.location,
            cameraName: device.description || `${device.brand} ${device.model}`,
            locationName: device.location?.name || 'Main Office',
            zoneGroup: device.zoneGroup || 'Main Area',
            eventType: 'ManualAlert',
            title: title || `Manual Security Alarm Triggered at ${device.description}`,
            description: description || 'Manual emergency alert triggered by security operator in portal',
            severity,
            status: 'Active',
            timestamp: new Date()
        });

        // Trigger siren audio broadcast on camera
        try {
            await fetch('http://127.0.0.1:5001/ip-camera/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: device._id.toString(),
                    message: 'Emergency Security Alert Activated.',
                    cue: 'siren'
                })
            });
        } catch (e) {
            // Ignore broadcast failure
        }

        res.status(201).json({ success: true, message: 'Manual security alert triggered', data: alert });
    } catch (error) {
        next(error);
    }
};

// @desc    Internal webhook called by Python Face Microservice when a security event is detected
// @route   POST /api/nvr/alerts/webhook
// @access  Public / Internal Microservice
exports.recordSecurityAlertWebhook = async (req, res, next) => {
    try {
        const {
            deviceId,
            eventType = 'StrangerIntrusion',
            title,
            description,
            severity = 'Medium',
            photoBase64,
            personName,
            employeeId,
            faceMatchScore,
            timestamp
        } = req.body;

        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId is required' });
        }

        const device = await Device.findById(deviceId).populate('location').populate('company');
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        let snapshotPath = null;
        if (photoBase64) {
            try {
                const alertFilename = `alert_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
                const alertFilePath = path.join(__dirname, '..', 'uploads', 'punches', alertFilename);
                const alertDir = path.dirname(alertFilePath);
                if (!fs.existsSync(alertDir)) fs.mkdirSync(alertDir, { recursive: true });
                const base64Clean = photoBase64.replace(/^data:image\/\w+;base64,/, "").trim();
                if (base64Clean.length > 50) {
                    fs.writeFileSync(alertFilePath, Buffer.from(base64Clean, 'base64'));
                    snapshotPath = `/uploads/punches/${alertFilename}`;
                }
            } catch (imgErr) {
                console.warn('[Alert Snapshot Warning]:', imgErr.message);
            }
        }

        let employeeRef = null;
        if (employeeId) {
            const emp = await Employee.findOne({ employeeId });
            if (emp) employeeRef = emp._id;
        }

        const alert = await SecurityAlert.create({
            device: device._id,
            company: device.company?._id || device.company,
            location: device.location?._id || device.location,
            cameraName: device.description || `${device.brand} ${device.model}`,
            locationName: device.location?.name || 'Main Office',
            zoneGroup: device.zoneGroup || 'Main Area',
            eventType,
            title: title || `${eventType} detected at ${device.description}`,
            description: description || `Automated surveillance alert from AI vision engine`,
            severity,
            snapshotPath,
            personName,
            employeeRef,
            faceMatchScore,
            status: 'Active',
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            notifiedEmployees: device.securityMonitoring?.notifyEmployees || []
        });

        console.log(`[Security Alert Logged]: ${alert.title} [${alert.severity}] at ${alert.locationName}`);
        res.status(201).json({ success: true, data: alert });
    } catch (error) {
        console.error('[Security Alert Webhook Error]:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
