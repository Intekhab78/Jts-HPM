const Device = require('../models/Device');
const User = require('../models/User');
const Role = require('../models/Role');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const BiometricPunchLog = require('../models/BiometricPunchLog');
const UnregisteredFaceLog = require('../models/UnregisteredFaceLog');
const VideoRecording = require('../models/VideoRecording');
const attendanceService = require('../services/attendanceService');
const faceServiceManager = require('../services/faceServiceManager');
const path = require('path');
const fs = require('fs');

// @desc    Get all registered kiosk & IP Camera devices
// @route   GET /api/devices
// @access  Private (Admin/HR)
exports.getDevices = async (req, res, next) => {
    try {
        const devices = await Device.find()
            .populate('company', 'name')
            .populate('location', 'name');
        res.status(200).json({ success: true, count: devices.length, data: devices });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new device registration (Kiosk or IP Camera)
// @route   POST /api/devices
// @access  Private (Admin/HR)
exports.createDevice = async (req, res, next) => {
    try {
        const {
            company,
            location,
            description,
            brand,
            model,
            imeiNo,
            email,
            password,
            deviceType = 'Kiosk',
            zoneGroup = 'Main Area',
            streamUrl,
            cameraIp,
            cameraPort = 554,
            cameraUsername,
            cameraPassword,
            channelNo = 1,
            streamProfile = 'sub',
            direction = 'auto',
            cooldownMinutes = 5
        } = req.body;

        if (!company || !location || !description || !brand || !model) {
            return res.status(400).json({ success: false, message: 'Please provide all required core fields (Company, Location, Description, Brand, Model).' });
        }

        const isIpCamera = deviceType === 'IPCamera';

        // For Kiosks, email and password are required
        if (!isIpCamera && (!email || !password)) {
            return res.status(400).json({ success: false, message: 'Kiosk terminals require Login Email and Password.' });
        }

        // For IP Cameras, streamUrl or cameraIp is required
        if (isIpCamera && !streamUrl && !cameraIp) {
            return res.status(400).json({ success: false, message: 'IP Cameras require an RTSP Stream URL or Camera IP.' });
        }

        // Construct full RTSP URL if streamUrl was not explicitly provided but camera parameters are
        let finalStreamUrl = streamUrl;
        if (!finalStreamUrl && cameraIp) {
            const authPart = cameraUsername ? `${encodeURIComponent(cameraUsername)}:${encodeURIComponent(cameraPassword || '')}@` : '';
            finalStreamUrl = `rtsp://${authPart}${cameraIp}:${cameraPort || 554}/Streaming/Channels/${channelNo}0${streamProfile === 'sub' ? '2' : '1'}`;
        }

        const userEmail = email ? email.toLowerCase().trim() : `ipcam_${Date.now()}_${Math.floor(Math.random() * 1000)}@internal.cam`;

        // Check email uniqueness if email provided
        if (email) {
            const emailExists = await User.findOne({ email: userEmail });
            if (emailExists) {
                return res.status(400).json({ success: false, message: 'Device credentials email already exists.' });
            }
        }

        // 1. Create Device record
        const device = await Device.create({
            company,
            location,
            description,
            brand,
            model,
            imeiNo,
            deviceType,
            zoneGroup: zoneGroup || 'Main Area',
            streamUrl: finalStreamUrl,
            cameraIp,
            cameraPort: Number(cameraPort) || 554,
            cameraUsername,
            cameraPassword,
            channelNo: Number(channelNo) || 1,
            streamProfile: streamProfile || 'sub',
            direction: direction || 'auto',
            cooldownMinutes: Number(cooldownMinutes) || 5,
            isStreamingActive: false,
            loginCredentials: {
                email: userEmail,
                password: password || 'IPCam_Secure_2026'
            }
        });

        // 2. Create User account for Kiosks (or optional camera account)
        if (!isIpCamera || email) {
            let role = await Role.findOne({ name: 'kiosk' });
            if (!role) role = await Role.findOne({ name: 'employee' }) || await Role.findOne();

            await User.create({
                name: `${description} (${brand} ${model})`,
                email: userEmail,
                password: password || 'IPCam_Secure_2026',
                role: role ? role._id : undefined,
                deviceRef: device._id,
                isActive: true
            });
        }

        res.status(201).json({ success: true, data: device });
    } catch (error) {
        next(error);
    }
};

// @desc    Update device settings
// @route   PUT /api/devices/:id
// @access  Private (Admin/HR)
exports.updateDevice = async (req, res, next) => {
    try {
        const {
            company,
            location,
            description,
            brand,
            model,
            imeiNo,
            isActive,
            recordingSchedule,
            deviceType,
            zoneGroup,
            streamUrl,
            cameraIp,
            cameraPort,
            cameraUsername,
            cameraPassword,
            channelNo,
            streamProfile,
            direction,
            cooldownMinutes,
            cameraRole
        } = req.body;

        const mongoose = require('mongoose');
        let device = null;

        if (req.params.id && req.params.id !== 'undefined' && req.params.id !== 'null' && mongoose.isValidObjectId(req.params.id)) {
            device = await Device.findById(req.params.id);
        }

        // Fallback search: If not found by ID, try matching by cameraIp or streamUrl
        if (!device && cameraIp) {
            device = await Device.findOne({ cameraIp });
        }
        if (!device && streamUrl && streamUrl !== '0') {
            device = await Device.findOne({ streamUrl });
        }

        // If still not found, gracefully auto-create / upsert if core fields are available
        if (!device) {
            if (description && (company || location || cameraIp || streamUrl)) {
                // Find fallback company/location if missing
                let compId = company;
                let locId = location;
                if (!compId) {
                    const firstComp = await require('../models/Company').findOne();
                    if (firstComp) compId = firstComp._id;
                }
                if (!locId) {
                    const firstLoc = await require('../models/Location').findOne(compId ? { company: compId } : {});
                    if (firstLoc) locId = firstLoc._id;
                }

                device = await Device.create({
                    company: compId,
                    location: locId,
                    description: description || 'IP Camera',
                    brand: brand || 'Hikvision',
                    model: model || '4MP Camera',
                    imeiNo,
                    isActive: isActive !== false,
                    deviceType: deviceType || 'IPCamera',
                    zoneGroup: zoneGroup || 'Main Area',
                    streamUrl: streamUrl || '',
                    cameraIp: cameraIp || '',
                    cameraPort: Number(cameraPort) || 554,
                    cameraUsername: cameraUsername || 'admin',
                    cameraPassword: cameraPassword || '',
                    channelNo: Number(channelNo) || 1,
                    streamProfile: streamProfile || 'sub',
                    direction: direction || 'auto',
                    cooldownMinutes: Number(cooldownMinutes) || 5,
                    cameraRole: cameraRole || 'FaceRecognition',
                    isStreamingActive: false,
                    loginCredentials: {
                        email: `ipcam_${Date.now()}@internal.cam`,
                        password: 'IPCam_Secure_2026'
                    }
                });

                return res.status(200).json({
                    success: true,
                    message: 'Device created and saved successfully.',
                    data: device
                });
            }

            return res.status(404).json({ success: false, message: 'Device not found.' });
        }

        // Update fields
        if (company) device.company = company;
        if (location) device.location = location;
        if (description) device.description = description;
        if (brand) device.brand = brand;
        if (model) device.model = model;
        if (imeiNo !== undefined) device.imeiNo = imeiNo;
        if (isActive !== undefined) device.isActive = isActive;
        if (deviceType) device.deviceType = deviceType;
        if (zoneGroup !== undefined) device.zoneGroup = zoneGroup;
        if (streamUrl !== undefined) device.streamUrl = streamUrl;
        if (cameraIp !== undefined) device.cameraIp = cameraIp;
        if (cameraPort !== undefined) device.cameraPort = Number(cameraPort);
        if (cameraUsername !== undefined) device.cameraUsername = cameraUsername;
        if (cameraPassword !== undefined) device.cameraPassword = cameraPassword;
        if (channelNo !== undefined) device.channelNo = Number(channelNo);
        if (streamProfile !== undefined) device.streamProfile = streamProfile;
        if (direction !== undefined) device.direction = direction;
        if (cooldownMinutes !== undefined) device.cooldownMinutes = Number(cooldownMinutes);
        if (cameraRole !== undefined) device.cameraRole = cameraRole;

        if (recordingSchedule) {
            device.recordingSchedule = {
                enabled: recordingSchedule.enabled !== undefined ? recordingSchedule.enabled : (device.recordingSchedule?.enabled || false),
                startHour: recordingSchedule.startHour || (device.recordingSchedule?.startHour || '09:00'),
                durationHours: recordingSchedule.durationHours !== undefined ? Number(recordingSchedule.durationHours) : (device.recordingSchedule?.durationHours || 8)
            };
        }

        await device.save();

        // Sync name changes to User model if applicable
        if (description) {
            await User.findOneAndUpdate(
                { deviceRef: device._id },
                { name: `${description} (${device.brand} ${device.model})`, isActive: device.isActive }
            );
        }

        // If streaming is active and settings changed, update Python stream worker
        if (device.deviceType === 'IPCamera' && device.isStreamingActive && device.isActive) {
            try {
                await fetch('http://127.0.0.1:5001/ip-camera/start-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: device._id,
                        streamUrl: device.streamUrl,
                        locationId: device.location,
                        zoneGroup: device.zoneGroup,
                        direction: device.direction,
                        cooldownMinutes: device.cooldownMinutes,
                        nodeWebhookUrl: 'http://127.0.0.1:5000/api/devices/ip-camera-punch'
                    })
                });
            } catch (syncErr) {
                console.warn('[IP Camera Stream Re-sync Warning]:', syncErr.message);
            }
        }

        res.status(200).json({ success: true, data: device });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete device and linked credentials
// @route   DELETE /api/devices/:id
// @access  Private (Admin/HR)
exports.deleteDevice = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found.' });
        }

        // Stop stream if active
        if (device.deviceType === 'IPCamera') {
            try {
                await fetch('http://127.0.0.1:5001/ip-camera/stop-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: device._id })
                });
            } catch (e) {
                // Ignore
            }
        }

        // Remove linked user account
        await User.findOneAndDelete({ deviceRef: device._id });

        // Remove device record
        await device.deleteOne();

        res.status(200).json({ success: true, message: 'Device and linked credentials deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

// @desc    Test RTSP/HTTP camera stream connectivity
// @route   POST /api/devices/test-stream
// @access  Private (Admin/HR)
exports.testCameraStream = async (req, res, next) => {
    try {
        const { streamUrl, cameraIp, cameraPort, cameraUsername, cameraPassword, channelNo, streamProfile } = req.body;

        let finalUrl = streamUrl;
        if (!finalUrl && cameraIp) {
            const authPart = cameraUsername ? `${encodeURIComponent(cameraUsername)}:${encodeURIComponent(cameraPassword || '')}@` : '';
            finalUrl = `rtsp://${authPart}${cameraIp}:${cameraPort || 554}/Streaming/Channels/${channelNo || 1}0${streamProfile === 'sub' ? '2' : '1'}`;
        }

        if (!finalUrl) {
            return res.status(400).json({ success: false, message: 'Please provide a stream URL or Camera IP' });
        }

        await faceServiceManager.ensureRunning();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const pyRes = await fetch('http://127.0.0.1:5001/ip-camera/test-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streamUrl: finalUrl }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await pyRes.json();
        return res.status(pyRes.status).json(data);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Stream test failed to connect' });
    }
};

// @desc    Toggle AI Face Recognition background stream on an IP Camera
// @route   POST /api/devices/:id/toggle-stream
// @access  Private (Admin/HR)
exports.toggleCameraStream = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found.' });
        }

        if (device.deviceType !== 'IPCamera') {
            return res.status(400).json({ success: false, message: 'Only IP Camera devices support stream recognition.' });
        }

        if (!device.streamUrl) {
            return res.status(400).json({ success: false, message: 'Device is missing an RTSP / HTTP stream URL.' });
        }

        await faceServiceManager.ensureRunning();

        const willStart = !device.isStreamingActive;

        if (willStart) {
            // Start stream in Python microservice
            const pyRes = await fetch('http://127.0.0.1:5001/ip-camera/start-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: device._id,
                    streamUrl: device.streamUrl,
                    locationId: device.location,
                    zoneGroup: device.zoneGroup || 'Main Area',
                    direction: device.direction || 'auto',
                    cooldownMinutes: device.cooldownMinutes || 5,
                    nodeWebhookUrl: 'http://127.0.0.1:5000/api/devices/ip-camera-punch'
                })
            });
            const data = await pyRes.json();
            if (!data.success) {
                return res.status(500).json({ success: false, message: data.message || 'Failed to start camera worker' });
            }
            device.isStreamingActive = true;
        } else {
            // Stop stream in Python microservice
            await fetch('http://127.0.0.1:5001/ip-camera/stop-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: device._id })
            });
            device.isStreamingActive = false;
        }

        await device.save();
        res.status(200).json({
            success: true,
            isStreamingActive: device.isStreamingActive,
            message: device.isStreamingActive ? 'AI Face Recognition stream started' : 'AI stream stopped'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get real-time camera stream status & AI detection counters
// @route   GET /api/devices/:id/camera-status
// @access  Private (Admin/HR)
exports.getCameraStatus = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found.' });
        }

        try {
            const pyRes = await fetch(`http://127.0.0.1:5001/ip-camera/status/${device._id}`);
            const data = await pyRes.json();
            return res.status(200).json(data);
        } catch (pyErr) {
            return res.status(200).json({
                success: true,
                isRunning: false,
                status: 'offline',
                error: pyErr.message
            });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Webhook receiver for IP Camera AI Face Recognition Punch
// @route   POST /api/devices/ip-camera-punch
// @access  Public / Internal Microservice
exports.recordIpCameraPunch = async (req, res, next) => {
    try {
        const { deviceId, employeeId, faceMatchScore, punchPhotoBase64, punchType = 'auto', timestamp } = req.body;

        if (!deviceId || !employeeId) {
            return res.status(400).json({ success: false, message: 'deviceId and employeeId are required' });
        }

        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: 'IP Camera device not found' });
        }

        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found in directory' });
        }

        // Save audit snapshot to disk
        let punchPhotoPath = null;
        if (punchPhotoBase64) {
            try {
                const punchFilename = `punch_ipcam_${employee.employeeId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
                const punchFilePath = path.join(__dirname, '..', 'uploads', 'punches', punchFilename);
                const punchesDir = path.dirname(punchFilePath);
                if (!fs.existsSync(punchesDir)) {
                    fs.mkdirSync(punchesDir, { recursive: true });
                }
                const base64Clean = punchPhotoBase64.replace(/^data:image\/\w+;base64,/, "").trim();
                if (base64Clean.length > 50) {
                    const imgBuffer = Buffer.from(base64Clean, 'base64');
                    fs.writeFileSync(punchFilePath, imgBuffer);
                    punchPhotoPath = `/uploads/punches/${punchFilename}`;
                }
            } catch (imgSaveErr) {
                console.error('[IP Camera Photo Save Warning]:', imgSaveErr.message);
            }
        }

        const effectiveType = (punchType && punchType !== 'auto') ? punchType : (device.direction || 'auto');
        const score = faceMatchScore !== undefined ? faceMatchScore : 95.0;

        // Call core attendance service
        const record = await attendanceService.processBiometricPunch(
            employee._id,
            effectiveType,
            null, // Fixed CCTV has no mobile GPS coords
            punchPhotoPath,
            score,
            false,
            timestamp ? new Date(timestamp) : new Date(),
            true, // isKiosk = true (bypasses mobile geofence radius)
            'IP-Camera',
            device._id
        );

        console.log(`[IP-Camera Attendance Success]: ${employee.firstName} ${employee.lastName} (${employee.employeeId}) via ${device.description} [${device.zoneGroup}]`);

        res.status(200).json({
            success: true,
            message: `IP Camera punch recorded for ${employee.firstName} ${employee.lastName}`,
            data: record
        });
    } catch (error) {
        console.error('[IP-Camera Attendance Webhook Error]:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Webhook receiver for Unregistered Visitor Face Log from IP Camera
// @route   POST /api/devices/unregistered-face-log
// @access  Public / Internal Microservice
exports.recordUnregisteredFaceLog = async (req, res, next) => {
    try {
        const { deviceId, photoBase64, timestamp, zoneGroup } = req.body;

        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId is required' });
        }

        const device = await Device.findById(deviceId).populate('location').populate('company');
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        let visitorPhotoPath = null;
        if (photoBase64) {
            try {
                const visitorFilename = `visitor_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
                const visitorFilePath = path.join(__dirname, '..', 'uploads', 'punches', visitorFilename);
                const punchesDir = path.dirname(visitorFilePath);
                if (!fs.existsSync(punchesDir)) {
                    fs.mkdirSync(punchesDir, { recursive: true });
                }
                const base64Clean = photoBase64.replace(/^data:image\/\w+;base64,/, "").trim();
                if (base64Clean.length > 50) {
                    const imgBuffer = Buffer.from(base64Clean, 'base64');
                    fs.writeFileSync(visitorFilePath, imgBuffer);
                    visitorPhotoPath = `/uploads/punches/${visitorFilename}`;
                }
            } catch (saveErr) {
                console.error('[Visitor Photo Save Error]:', saveErr.message);
            }
        }

        if (!visitorPhotoPath) {
            return res.status(400).json({ success: false, message: 'Photo is required for visitor face log' });
        }

        const log = await UnregisteredFaceLog.create({
            device: device._id,
            company: device.company?._id || device.company,
            location: device.location?._id || device.location,
            zoneGroup: zoneGroup || device.zoneGroup || 'Main Area',
            cameraName: device.description || `${device.brand} ${device.model}`,
            locationName: device.location?.name || 'Main Office',
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            photoPath: visitorPhotoPath,
            tag: 'Unregistered Visitor',
            status: 'Unregistered'
        });

        console.log(`[Visitor Face Log Recorded]: Camera ${log.cameraName} in ${log.zoneGroup} at ${log.timestamp}`);

        res.status(201).json({ success: true, message: 'Unregistered visitor face logged', data: log });
    } catch (error) {
        console.error('[Visitor Log Webhook Error]:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all unregistered visitor logs with filtering & pagination
// @route   GET /api/devices/unregistered-face-logs
// @access  Private (Admin/HR/Manager)
exports.getUnregisteredFaceLogs = async (req, res, next) => {
    try {
        const {
            startDate,
            endDate,
            location,
            device,
            status,
            tag,
            search,
            page = 1,
            limit = 50
        } = req.query;

        const query = {};

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

        if (location) query.location = location;
        if (device) query.device = device;
        if (status && status !== 'ALL') query.status = status;
        if (tag && tag !== 'ALL') query.tag = tag;
        if (search) {
            query.$or = [
                { visitorName: { $regex: search, $options: 'i' } },
                { tag: { $regex: search, $options: 'i' } },
                { cameraName: { $regex: search, $options: 'i' } },
                { zoneGroup: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await UnregisteredFaceLog.countDocuments(query);
        const logs = await UnregisteredFaceLog.find(query)
            .populate('device', 'description brand model')
            .populate('location', 'name address')
            .populate('company', 'name')
            .populate('convertedEmployee', 'firstName lastName employeeId profilePhoto')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Quick statistics for today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todayCount = await UnregisteredFaceLog.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd } });
        const unaddressedCount = await UnregisteredFaceLog.countDocuments({ status: 'Unregistered' });
        const taggedCount = await UnregisteredFaceLog.countDocuments({ status: { $in: ['Tagged', 'Converted to Employee'] } });

        res.status(200).json({
            success: true,
            count: logs.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            summary: {
                totalLogs: total,
                todayVisitors: todayCount,
                unaddressed: unaddressedCount,
                tagged: taggedCount
            },
            data: logs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update visitor details / tag / notes
// @route   PUT /api/devices/unregistered-face-logs/:id
// @access  Private (Admin/HR/Manager)
exports.updateUnregisteredFaceLog = async (req, res, next) => {
    try {
        const { visitorName, tag, notes, status } = req.body;
        const log = await UnregisteredFaceLog.findById(req.params.id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Visitor log record not found' });
        }

        if (visitorName !== undefined) log.visitorName = visitorName;
        if (tag !== undefined) log.tag = tag;
        if (notes !== undefined) log.notes = notes;
        if (status !== undefined) log.status = status;
        else if (visitorName && log.status === 'Unregistered') {
            log.status = 'Tagged';
        }

        await log.save();
        res.status(200).json({ success: true, message: 'Visitor log updated successfully', data: log });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete unregistered visitor log
// @route   DELETE /api/devices/unregistered-face-logs/:id
// @access  Private (Admin/HR)
exports.deleteUnregisteredFaceLog = async (req, res, next) => {
    try {
        const log = await UnregisteredFaceLog.findById(req.params.id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Visitor log record not found' });
        }

        // Delete photo if exists
        if (log.photoPath) {
            try {
                const absPath = path.join(__dirname, '..', log.photoPath.replace(/^\//, ''));
                if (fs.existsSync(absPath)) {
                    fs.unlinkSync(absPath);
                }
            } catch (e) {
                // Ignore file removal error
            }
        }

        await log.deleteOne();
        res.status(200).json({ success: true, message: 'Visitor log deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Test voice synthesis announcement on IP camera / server speakers
// @route   POST /api/devices/test-voice
// @access  Private (Admin/HR)
exports.testVoiceResponse = async (req, res, next) => {
    try {
        const { text } = req.body;
        await faceServiceManager.ensureRunning();
        const pyRes = await fetch('http://127.0.0.1:5001/test-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text || 'Thank you, voice response system is active and operational.' })
        });
        const data = await pyRes.json();
        return res.status(pyRes.status).json(data);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Voice test failed' });
    }
};

// @desc    Start video surveillance recording for an IP camera
// @route   POST /api/devices/:id/start-recording
// @access  Private (Admin/HR)
exports.startCameraRecording = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id).populate('location').populate('company');
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        if (device.deviceType !== 'IPCamera') {
            return res.status(400).json({ success: false, message: 'Only IP Cameras support video recording' });
        }

        await faceServiceManager.ensureRunning();

        // Check if stream is currently running in python service
        let isRunning = false;
        try {
            const statusRes = await fetch(`http://127.0.0.1:5001/ip-camera/status/${device._id}`);
            const statusData = await statusRes.json();
            isRunning = statusData.isRunning;
        } catch (e) {
            isRunning = false;
        }

        // If streaming is not running, start stream worker first
        if (!isRunning) {
            const startPy = await fetch('http://127.0.0.1:5001/ip-camera/start-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: device._id,
                    streamUrl: device.streamUrl,
                    locationId: device.location?._id || device.location,
                    zoneGroup: device.zoneGroup || 'Main Area',
                    direction: device.direction || 'auto',
                    cooldownMinutes: device.cooldownMinutes || 5,
                    nodeWebhookUrl: 'http://127.0.0.1:5000/api/devices/ip-camera-punch'
                })
            });
            const startData = await startPy.json();
            if (startData.success) {
                device.isStreamingActive = true;
                await device.save();
                // Wait briefly for first video frame to connect
                await new Promise(r => setTimeout(r, 600));
            }
        }

        const recordingType = req.body.recordingType || 'Manual';

        // Pre-create database entry in Recording status
        const recording = await VideoRecording.create({
            device: device._id,
            company: device.company?._id || device.company,
            location: device.location?._id || device.location,
            cameraName: device.description || `${device.brand} ${device.model}`,
            locationName: device.location?.name || 'Main Office',
            zoneGroup: device.zoneGroup || 'Main Area',
            recordingType,
            filePath: 'pending',
            status: 'Recording',
            startTime: new Date()
        });

        // Trigger Python worker recording writer
        const pyRes = await fetch('http://127.0.0.1:5001/ip-camera/start-recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: device._id.toString(),
                recordingType,
                recordingId: recording._id.toString()
            })
        });

        const data = await pyRes.json();
        if (!data.success) {
            await recording.deleteOne();
            return res.status(400).json(data);
        }

        if (data.filePath) {
            recording.filePath = data.filePath;
            recording.thumbnailPath = data.thumbnailPath;
            await recording.save();
        }

        res.status(200).json({
            success: true,
            message: data.message || 'Video recording started',
            data: recording
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Stop active video surveillance recording
// @route   POST /api/devices/:id/stop-recording
// @access  Private (Admin/HR)
exports.stopCameraRecording = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        await faceServiceManager.ensureRunning();

        const pyRes = await fetch('http://127.0.0.1:5001/ip-camera/stop-recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: device._id.toString() })
        });

        const data = await pyRes.json();
        return res.status(pyRes.status).json(data);
    } catch (error) {
        next(error);
    }
};

// @desc    Webhook receiver when a video recording file is finalized
// @route   POST /api/devices/recordings/complete
// @access  Public / Internal Microservice
exports.finalizeVideoRecording = async (req, res, next) => {
    try {
        const {
            deviceId,
            recordingId,
            recordingType = 'Manual',
            filePath,
            thumbnailPath,
            fileSize = 0,
            durationSeconds = 0,
            startTime,
            endTime
        } = req.body;

        let recording = null;
        if (recordingId) {
            recording = await VideoRecording.findById(recordingId);
        }

        if (!recording && deviceId) {
            recording = await VideoRecording.findOne({
                device: deviceId,
                status: 'Recording'
            }).sort({ createdAt: -1 });
        }

        const device = deviceId ? await Device.findById(deviceId).populate('location').populate('company') : null;

        if (recording) {
            recording.filePath = filePath || recording.filePath;
            recording.thumbnailPath = thumbnailPath || recording.thumbnailPath;
            recording.fileSize = Number(fileSize) || recording.fileSize;
            recording.durationSeconds = Number(durationSeconds) || recording.durationSeconds;
            if (startTime) recording.startTime = new Date(startTime);
            recording.endTime = endTime ? new Date(endTime) : new Date();
            recording.status = 'Completed';
            await recording.save();
        } else if (device) {
            recording = await VideoRecording.create({
                device: device._id,
                company: device.company?._id || device.company,
                location: device.location?._id || device.location,
                cameraName: device.description || `${device.brand} ${device.model}`,
                locationName: device.location?.name || 'Main Office',
                zoneGroup: device.zoneGroup || 'Main Area',
                recordingType,
                filePath,
                thumbnailPath,
                fileSize: Number(fileSize) || 0,
                durationSeconds: Number(durationSeconds) || 0,
                startTime: startTime ? new Date(startTime) : new Date(),
                endTime: endTime ? new Date(endTime) : new Date(),
                status: 'Completed'
            });
        }

        console.log(`[Video Recording Finalized]: ${recording?.cameraName} -> ${filePath} (${durationSeconds}s, ${fileSize}B)`);
        res.status(200).json({ success: true, data: recording });
    } catch (error) {
        console.error('[Finalize Video Webhook Error]:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get surveillance video recordings archive with filtering
// @route   GET /api/devices/recordings
// @access  Private (Admin/HR)
exports.getVideoRecordings = async (req, res, next) => {
    try {
        const {
            deviceId,
            locationId,
            recordingType,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 30
        } = req.query;

        const query = {};

        if (deviceId) query.device = deviceId;
        if (locationId) query.location = locationId;
        if (recordingType && recordingType !== 'ALL') query.recordingType = recordingType;

        if (startDate || endDate) {
            query.startTime = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                query.startTime.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                query.startTime.$lte = e;
            }
        }

        if (search) {
            query.$or = [
                { cameraName: { $regex: search, $options: 'i' } },
                { locationName: { $regex: search, $options: 'i' } },
                { zoneGroup: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await VideoRecording.countDocuments(query);
        const recordings = await VideoRecording.find(query)
            .populate('device', 'description brand model')
            .populate('location', 'name')
            .populate('company', 'name')
            .sort({ startTime: -1 })
            .skip(skip)
            .limit(Number(limit));

        const totalSizeBytes = await VideoRecording.aggregate([
            { $match: query },
            { $group: { _id: null, totalSize: { $sum: '$fileSize' }, totalDuration: { $sum: '$durationSeconds' } } }
        ]);

        const summary = {
            totalRecordings: total,
            totalSizeBytes: totalSizeBytes[0]?.totalSize || 0,
            totalDurationSecs: totalSizeBytes[0]?.totalDuration || 0
        };

        res.status(200).json({
            success: true,
            count: recordings.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            summary,
            data: recordings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a video surveillance recording file and record
// @route   DELETE /api/devices/recordings/:id
// @access  Private (Admin/HR)
exports.deleteVideoRecording = async (req, res, next) => {
    try {
        const recording = await VideoRecording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({ success: false, message: 'Video recording not found' });
        }

        // Delete physical video and thumbnail files
        if (recording.filePath) {
            try {
                const absVid = path.join(__dirname, '..', recording.filePath.replace(/^\//, ''));
                if (fs.existsSync(absVid)) fs.unlinkSync(absVid);
            } catch (fe) {
                // Ignore file unlink error
            }
        }
        if (recording.thumbnailPath) {
            try {
                const absThumb = path.join(__dirname, '..', recording.thumbnailPath.replace(/^\//, ''));
                if (fs.existsSync(absThumb)) fs.unlinkSync(absThumb);
            } catch (te) {
                // Ignore thumbnail unlink error
            }
        }

        await recording.deleteOne();
        res.status(200).json({ success: true, message: 'Video recording deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    1-Click shortcut to switch camera stream to local webcam (Camera 0)
// @route   POST /api/devices/:id/use-webcam
// @access  Private (Admin/HR)
exports.switchToWebcam = async (req, res, next) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        device.streamUrl = '0';
        device.cameraIp = '127.0.0.1';
        device.isStreamingActive = true;
        await device.save();

        await faceServiceManager.ensureRunning();

        // Update Python stream worker
        const pyRes = await fetch('http://127.0.0.1:5001/ip-camera/start-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: device._id,
                streamUrl: '0',
                locationId: device.location,
                zoneGroup: device.zoneGroup || 'Main Area',
                direction: device.direction || 'auto',
                cooldownMinutes: device.cooldownMinutes || 5,
                nodeWebhookUrl: 'http://127.0.0.1:5000/api/devices/ip-camera-punch'
            })
        });

        const data = await pyRes.json();
        res.status(200).json({
            success: true,
            message: 'Camera stream switched to Local Webcam (Camera 0)',
            data: device,
            python: data
        });
    } catch (error) {
        next(error);
    }
};

// Helper: Fallback to single snapshot from Python microservice
function fallbackToSnapshot(deviceId, res) {
    const http = require('http');
    const snapReq = http.get(`http://127.0.0.1:5001/ip-camera/snapshot/${deviceId}`, (snapRes) => {
        if (snapRes.statusCode === 200) {
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            snapRes.pipe(res);
            snapRes.on('error', () => {
                if (!res.headersSent) res.status(502).end();
                else res.end();
            });
        } else {
            if (!res.headersSent) {
                res.status(404).json({ success: false, message: 'Camera feed currently offline' });
            }
        }
    });

    snapReq.on('error', () => {
        if (!res.headersSent) {
            res.status(404).json({ success: false, message: 'Camera feed currently offline' });
        }
    });
}

// @desc    Live camera video stream proxy (MJPEG multipart with snapshot fallback)
// @route   GET /api/devices/:id/live-stream
// @access  Public
exports.getLiveCameraStream = async (req, res, next) => {
    const http = require('http');
    const deviceId = req.params.id;

    try {
        await faceServiceManager.ensureRunning();
    } catch (e) {
        // Continue and attempt stream proxy
    }

    let isHandled = false;

    const proxyReq = http.get(`http://127.0.0.1:5001/ip-camera/mjpeg/${deviceId}`, (pyRes) => {
        if (pyRes.statusCode === 200) {
            isHandled = true;
            res.writeHead(200, {
                'Content-Type': pyRes.headers['content-type'] || 'multipart/x-mixed-replace; boundary=frame',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Connection': 'close'
            });

            pyRes.pipe(res);

            pyRes.on('error', (err) => {
                console.warn(`[Live Stream Proxy Error for ${deviceId}]:`, err.message);
                if (!res.headersSent) {
                    res.status(502).end();
                } else {
                    res.end();
                }
            });
        } else {
            fallbackToSnapshot(deviceId, res);
        }
    });

    proxyReq.on('error', (err) => {
        if (!isHandled) {
            fallbackToSnapshot(deviceId, res);
        }
    });

    // When client disconnects or closes tab, abort upstream request cleanly
    req.on('close', () => {
        try {
            proxyReq.destroy();
        } catch (e) {
            // ignore
        }
    });
};

// @desc    Single annotated frame snapshot
// @route   GET /api/devices/:id/snapshot
// @access  Public
exports.getLiveCameraSnapshot = async (req, res, next) => {
    try {
        const deviceId = req.params.id;
        fallbackToSnapshot(deviceId, res);
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
};




