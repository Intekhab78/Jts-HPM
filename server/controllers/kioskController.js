const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Device = require('../models/Device');
const User = require('../models/User');
const attendanceService = require('../services/attendanceService');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// @desc    Verify PIN punch at kiosk
// @route   POST /api/kiosk/verify-pin
// @access  Private (Kiosk Role)
exports.verifyPinPunch = async (req, res, next) => {
    try {
        const { employeeId, pin, type, lat, lng, isUnmapped, userCredentials } = req.body;

        if (!employeeId || !pin || !type) {
            return res.status(400).json({ success: false, message: 'Please provide employeeId, pin, and punch type' });
        }

        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(404).json({ 
                success: false, 
                isUnregistered: true,
                message: 'You are not registered. Please contact Admin / HR.' 
            });
        }

        if (!employee.profilePhoto) {
            return res.status(400).json({ 
                success: false, 
                message: 'Profile photo is missing, can not record attendance, please contact admin.' 
            });
        }

        // Validate Kiosk Location Mapping
        let locationId = null;
        if (req.user && req.user.deviceRef) {
            const dev = await Device.findById(req.user.deviceRef);
            if (dev) locationId = dev.location;
        }

        let isLocationMapped = true;
        if (locationId) {
            const isPrimaryLoc = employee.location && employee.location.toString() === locationId.toString();
            const isAllowedFence = employee.geoFencing?.allowedFences?.some(
                f => f.location && f.location.toString() === locationId.toString()
            );
            isLocationMapped = isPrimaryLoc || isAllowedFence;
        }

        if (!isLocationMapped) {
            if (!isUnmapped) {
                return res.status(403).json({
                    success: false,
                    isUnmapped: true,
                    employeeId: employee.employeeId,
                    message: 'You are not mapped to this location. Please contact Admin / HR.'
                });
            }

            // If unmapped and requesting bypass with credentials
            if (userCredentials && userCredentials.email && userCredentials.password) {
                const user = await User.findOne({ email: userCredentials.email.toLowerCase().trim() }).select('+password');
                if (!user) {
                    return res.status(401).json({ success: false, message: 'Bypass authorization failed: Account not found.' });
                }
                const isPasswordValid = await user.comparePassword(userCredentials.password);
                if (!isPasswordValid) {
                    return res.status(401).json({ success: false, message: 'Bypass authorization failed: Invalid password.' });
                }
            } else {
                return res.status(400).json({ success: false, message: 'Portal credentials required for unmapped punch bypass.' });
            }
        }

        if (!isUnmapped && employee.kioskPin !== pin) {
            return res.status(400).json({ success: false, message: 'Incorrect PIN' });
        }

        let location = null;
        if (lat && lng) {
            location = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }

        const record = await attendanceService.processBiometricPunch(
            employee._id,
            type,
            location,
            null, // No photo saved locally
            100,  // PIN punch has 100% match score
            false,
            null,
            true,
            'PIN',
            req.user && req.user.deviceRef ? req.user.deviceRef : null
        );

        // Track kiosk context details if bypassed
        if (!isLocationMapped && isUnmapped) {
            record.approvalStatus = 'Pending Manager';
            record.geoFenceWarning = 'Outside Mapped Location Punch (Bypassed with credentials)';
            await record.save();
        }

        res.status(200).json({
            success: true,
            message: `Punch successful for ${employee.firstName} ${employee.lastName}`,
            punchType: record.checkOut ? 'out' : 'in',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify QR code punch at kiosk
// @route   POST /api/kiosk/verify-qr
// @access  Private (Kiosk Role)
exports.verifyQrPunch = async (req, res, next) => {
    try {
        const { qrData, type, lat, lng } = req.body;

        if (!qrData || !type) {
            return res.status(400).json({ success: false, message: 'Please provide QR data and punch type' });
        }

        let parsed;
        try {
            parsed = JSON.parse(qrData);
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid QR Code format' });
        }

        const { employeeId, timestamp } = parsed;
        if (!employeeId || !timestamp) {
            return res.status(400).json({ success: false, message: 'Invalid QR Code structure' });
        }

        // Check if QR has expired (older than 2 minutes)
        const qrTime = new Date(timestamp);
        const currentTime = new Date();
        const diffSeconds = Math.abs((currentTime.getTime() - qrTime.getTime()) / 1000);
        
        if (diffSeconds > 120) {
            return res.status(400).json({ success: false, message: 'QR Code has expired. Please refresh the screen.' });
        }

        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(404).json({ 
                success: false, 
                isUnregistered: true,
                message: 'You are not registered. Please contact Admin / HR.' 
            });
        }

        if (!employee.profilePhoto) {
            return res.status(400).json({ 
                success: false, 
                message: 'Profile photo is missing, can not record attendance, please contact admin.' 
            });
        }

        // Validate Kiosk Location Mapping
        let locationId = null;
        if (req.user && req.user.deviceRef) {
            const dev = await Device.findById(req.user.deviceRef);
            if (dev) locationId = dev.location;
        }

        if (locationId) {
            const isPrimaryLoc = employee.location && employee.location.toString() === locationId.toString();
            const isAllowedFence = employee.geoFencing?.allowedFences?.some(
                f => f.location && f.location.toString() === locationId.toString()
            );

            if (!isPrimaryLoc && !isAllowedFence) {
                return res.status(403).json({
                    success: false,
                    isUnmapped: true,
                    employeeId: employee.employeeId,
                    message: 'You are not mapped to this location. Please contact Admin / HR.'
                });
            }
        }

        let location = null;
        if (lat && lng) {
            location = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }

        const record = await attendanceService.processBiometricPunch(
            employee._id,
            type,
            location,
            null,
            100, // QR has 100% authentication confidence
            false,
            null,
            true,
            'QR',
            req.user && req.user.deviceRef ? req.user.deviceRef : null
        );

        res.status(200).json({
            success: true,
            message: `QR Punch successful for ${employee.firstName} ${employee.lastName}`,
            punchType: record.checkOut ? 'out' : 'in',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify face recognition punch at kiosk
// @route   POST /api/kiosk/verify-face
// @access  Private (Kiosk Role)
const faceServiceManager = require('../services/faceServiceManager');

let isCacheSynced = false;
let isCacheSyncing = false;

const syncPythonFaceCache = async () => {
    if (isCacheSynced || isCacheSyncing) return;
    isCacheSyncing = true;
    try {
        const isHealthy = await faceServiceManager.isHealthy();
        if (!isHealthy) {
            await faceServiceManager.ensureRunning();
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const employees = await Employee.find({ profilePhoto: { $ne: null } }).select('employeeId profilePhoto');
        const res = await fetch('http://127.0.0.1:5001/sync-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employees }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        console.log('[Face Service Sync Cache]:', data.message || 'Cached successfully');
        isCacheSynced = true;
    } catch (e) {
        console.error('[Face Service Sync Cache Error]:', e.message);
    } finally {
        isCacheSyncing = false;
    }
};

// @desc    Verify face recognition punch at kiosk
// @route   POST /api/kiosk/verify-face
// @access  Private (Kiosk Role)
exports.verifyFacePunch = async (req, res, next) => {
    try {
        const { faceImageBase64, type, lat, lng } = req.body;

        if (!faceImageBase64 || !type) {
            return res.status(400).json({ success: false, message: 'Please capture face image and select punch type' });
        }

        // Find Kiosk Device's location
        let locationId = null;
        if (req.user && req.user.deviceRef) {
            const dev = await Device.findById(req.user.deviceRef);
            if (dev) locationId = dev.location;
        }
        if (!locationId && req.user && req.user.location) {
            locationId = req.user.location;
        }
        if (!locationId) {
            const Location = require('../models/Location');
            const defaultLoc = await Location.findOne({ isActive: true });
            if (defaultLoc) locationId = defaultLoc._id;
        }

        // Progressive cache loading - sync in background if not done, but don't await blocking
        if (!isCacheSynced) {
            syncPythonFaceCache().catch(err => console.error('[Face Cache Async Error]:', err.message));
        }

        // 1. Query employees mapped to this kiosk location (primary location OR allowed geofences)
        const locationQuery = locationId ? {
            $or: [
                { location: locationId },
                { 'geoFencing.allowedFences.location': locationId }
            ],
            isActive: { $ne: false }
        } : { isActive: { $ne: false } };

        const localEmployees = await Employee.find(locationQuery);
        const localEmployeesWithPhoto = localEmployees.filter(emp => emp.profilePhoto);

        // 2. First attempt match against local location employees
        let matchResult = null;
        let matchResp = null;

        if (localEmployeesWithPhoto.length > 0) {
            try {
                matchResp = await faceServiceManager.matchFaceWithAutoRetry({
                    faceImageBase64,
                    candidates: localEmployeesWithPhoto.map(emp => ({
                        employeeId: emp.employeeId,
                        profilePhoto: emp.profilePhoto
                    }))
                }, 2);
                matchResult = matchResp?.data;
            } catch (fetchErr) {
                console.error('[Face Service Local Match Error]:', fetchErr.message);
            }
        }

        // 3. If matched a local employee successfully
        if (matchResult && matchResult.success) {
            const matchedEmpId = matchResult.employeeId;
            const employee = localEmployeesWithPhoto.find(emp => emp.employeeId === matchedEmpId);

            if (!employee) {
                return res.status(404).json({ success: false, message: 'Matched employee context not found' });
            }

            const faceMatchScore = matchResult.score !== undefined ? matchResult.score : 95.0;

            let location = null;
            if (lat && lng) {
                location = { lat: parseFloat(lat), lng: parseFloat(lng) };
            }

            // Save captured verification photo permanently
            let punchPhotoPath = null;
            try {
                const punchFilename = `punch_${employee.employeeId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
                const punchFilePath = path.join(__dirname, '..', 'uploads', 'punches', punchFilename);
                
                const punchesDir = path.dirname(punchFilePath);
                if (!fs.existsSync(punchesDir)) {
                    fs.mkdirSync(punchesDir, { recursive: true });
                }

                const base64CleanData = faceImageBase64.replace(/^data:image\/\w+;base64,/, "");
                fs.writeFileSync(punchFilePath, base64CleanData, 'base64');
                punchPhotoPath = `/uploads/punches/${punchFilename}`;
            } catch (imgSaveErr) {
                console.error('[Face Service Image Save Warning]:', imgSaveErr.message);
            }

            const record = await attendanceService.processBiometricPunch(
                employee._id,
                type,
                location,
                punchPhotoPath,
                faceMatchScore,
                false,
                null,
                true,
                'Face',
                req.user && req.user.deviceRef ? req.user.deviceRef : null
            );

            return res.status(200).json({
                success: true,
                message: `Punch recorded successfully`,
                employee: {
                    _id: employee._id,
                    employeeId: employee.employeeId,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    profilePhoto: employee.profilePhoto
                },
                punchType: record.checkOut === record.checkIn ? 'in' : 'out',
                matchScore: faceMatchScore
            });
        }

        // 4. If face was not detected at all in the frame
        if (matchResult && matchResult.faceDetected === false) {
            return res.status(400).json({
                success: false,
                faceDetected: false,
                message: 'No face detected in captured image'
            });
        }

        // 5. Face WAS detected, but not matched with local location candidates.
        // Check if this face belongs to an employee registered in ANOTHER location!
        const localIds = localEmployees.map(e => e._id);
        const otherEmployees = await Employee.find({
            _id: { $nin: localIds },
            isActive: { $ne: false },
            profilePhoto: { $ne: null }
        });

        let otherResult = null;
        if (otherEmployees.length > 0) {
            try {
                const otherResp = await faceServiceManager.matchFaceWithAutoRetry({
                    faceImageBase64,
                    candidates: otherEmployees.map(emp => ({
                        employeeId: emp.employeeId,
                        profilePhoto: emp.profilePhoto
                    }))
                }, 2);

                otherResult = otherResp?.data;
                if (otherResult && otherResult.success) {
                    const matchedOther = otherEmployees.find(e => e.employeeId === otherResult.employeeId);
                    return res.status(403).json({
                        success: false,
                        isUnmapped: true,
                        employeeId: matchedOther?.employeeId || otherResult.employeeId,
                        employeeName: matchedOther ? `${matchedOther.firstName} ${matchedOther.lastName}` : 'Employee',
                        message: 'You are not mapped to this location. Please contact Admin / HR.'
                    });
                }
            } catch (otherErr) {
                console.error('[Face Service Other Location Match Error]:', otherErr.message);
            }
        }

        // If other match check confirmed no face detected
        if (otherResult && otherResult.faceDetected === false) {
            return res.status(400).json({
                success: false,
                faceDetected: false,
                message: 'No face detected in captured image'
            });
        }

        // 6. If no employee in ANY location matched -> Unregistered Person!
        return res.status(404).json({
            success: false,
            isUnregistered: true,
            message: 'You are not registered. Please contact Admin / HR.'
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Download/Sync employee directory filtered by kiosk location context
// @route   GET /api/kiosk/sync-employees
// @access  Private (Kiosk Role)
exports.syncEmployees = async (req, res, next) => {
    try {
        syncPythonFaceCache().catch(err => console.error('Background sync failed:', err.message));
        const filter = { isActive: { $ne: false } };
        if (req.user && req.user.deviceRef) {
            const device = await Device.findById(req.user.deviceRef);
            if (device && device.location) {
                // Return employees assigned to the kiosk device's branch location
                filter.$or = [
                    { location: device.location },
                    { 'geoFencing.allowedFences.location': device.location }
                ];
            }
        }

        const employees = await Employee.find(filter, 'employeeId kioskPin firstName lastName faceTemplate location');
        res.status(200).json({ success: true, count: employees.length, data: employees });
    } catch (error) {
        next(error);
    }
};

// @desc    Sync batch offline punches to server database
// @route   POST /api/kiosk/sync-offline-punch
// @access  Private (Kiosk Role)
exports.syncOfflinePunch = async (req, res, next) => {
    try {
        const { punches } = req.body;
        if (!punches || !Array.isArray(punches)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing batch punches array' });
        }

        const results = [];

        for (const punch of punches) {
            try {
                const { employeeId, type, timestamp, lat, lng, punchMethod, isUnmapped, userCredentials } = punch;
                const employee = await Employee.findOne({ employeeId });
                if (!employee) {
                    results.push({ employeeId, success: false, message: 'Employee not found' });
                    continue;
                }

                // If unmapped, verify credentials first
                let validationPassed = true;
                let approvalStatus = 'Auto-Approved';
                let geoFenceWarning = undefined;

                if (isUnmapped) {
                    validationPassed = false;
                    if (userCredentials && userCredentials.email && userCredentials.password) {
                        const user = await User.findOne({ email: userCredentials.email.toLowerCase().trim() }).select('+password');
                        if (user) {
                            const isMatch = await user.comparePassword(userCredentials.password);
                            if (isMatch) {
                                validationPassed = true;
                                approvalStatus = 'Pending Manager';
                                geoFenceWarning = 'Outside Map Location Punch Recorded (Bypassed with credentials)';
                            }
                        }
                    }
                }

                if (!validationPassed) {
                    results.push({ employeeId, success: false, message: 'Bypass authentication failed' });
                    continue;
                }

                let location = null;
                if (lat && lng) {
                    location = { lat: parseFloat(lat), lng: parseFloat(lng) };
                }

                // Call core attendance service, sending the offline custom timestamp
                const record = await attendanceService.processBiometricPunch(
                    employee._id,
                    type,
                    location,
                    null, // No offline selfie photo sync
                    100,  // Confidence match score
                    false,
                    timestamp, // customTime
                    true, // isKiosk
                    punchMethod || 'PIN',
                    req.user && req.user.deviceRef ? req.user.deviceRef : null
                );

                // Populate Approval override context if unmapped
                if (approvalStatus !== 'Auto-Approved' || geoFenceWarning) {
                    record.approvalStatus = approvalStatus;
                    if (geoFenceWarning) {
                        record.geoFenceWarning = geoFenceWarning;
                    }
                    await record.save();
                }

                results.push({ employeeId, success: true, message: 'Punch synced successfully' });
            } catch (e) {
                results.push({ employeeId, success: false, message: e.message || 'Processing error' });
            }
        }

        res.status(200).json({ success: true, results });
    } catch (error) {
        next(error);
    }
};
