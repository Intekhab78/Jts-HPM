const WorkingDayOverride = require('../models/WorkingDayOverride');
const AttendanceSettings = require('../models/AttendanceSettings');

// @desc    Get attendance settings (singleton)
// @route   GET /api/settings/attendance
// @access  Private (Admin/HR)
exports.getAttendanceSettings = async (req, res, next) => {
    try {
        let settings = await AttendanceSettings.findOne();
        if (!settings) {
            settings = await AttendanceSettings.create({});
        }
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

// @desc    Update attendance settings (singleton)
// @route   PUT /api/settings/attendance
// @access  Private (Admin/HR)
exports.updateAttendanceSettings = async (req, res, next) => {
    try {
        const {
            officeStartTime, officeEndTime, expectedWorkingHours,
            lateMarkingEnabled, lateGraceMinutes,
            overtimeEnabled, otMinimumMinutes,
            halfDayThresholdMinutes
        } = req.body;

        let settings = await AttendanceSettings.findOne();
        if (!settings) {
            settings = new AttendanceSettings();
        }

        if (officeStartTime !== undefined) settings.officeStartTime = officeStartTime;
        if (officeEndTime !== undefined) settings.officeEndTime = officeEndTime;
        if (expectedWorkingHours !== undefined) settings.expectedWorkingHours = expectedWorkingHours;
        if (lateMarkingEnabled !== undefined) settings.lateMarkingEnabled = lateMarkingEnabled;
        if (lateGraceMinutes !== undefined) settings.lateGraceMinutes = lateGraceMinutes;
        if (overtimeEnabled !== undefined) settings.overtimeEnabled = overtimeEnabled;
        if (otMinimumMinutes !== undefined) settings.otMinimumMinutes = otMinimumMinutes;
        if (halfDayThresholdMinutes !== undefined) settings.halfDayThresholdMinutes = halfDayThresholdMinutes;

        await settings.save();
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all overrides
// @route   GET /api/settings/overrides
// @access  Private (Admin/HR)
exports.getOverrides = async (req, res, next) => {
    try {
        const overrides = await WorkingDayOverride.find()
            .populate('company', 'name')
            .populate('location', 'name')
            .sort({ fromDate: -1 });

        res.status(200).json({ success: true, count: overrides.length, data: overrides });
    } catch (error) {
        next(error);
    }
};

// @desc    Create an override
// @route   POST /api/settings/overrides
// @access  Private (Admin/HR)
exports.createOverride = async (req, res, next) => {
    try {
        const { title, fromDate, toDate, company, location, type, workingHours } = req.body;

        const override = await WorkingDayOverride.create({
            title,
            fromDate,
            toDate,
            company: company || null,
            location: location || null,
            type,
            workingHours: type === 'Full Day Off' ? 0 : (workingHours || 9)
        });

        res.status(201).json({ success: true, data: override });
    } catch (error) {
        next(error);
    }
};

// @desc    Update an override
// @route   PUT /api/settings/overrides/:id
// @access  Private (Admin/HR)
exports.updateOverride = async (req, res, next) => {
    try {
        const { title, fromDate, toDate, company, location, type, workingHours } = req.body;

        const updatedData = {
            title,
            fromDate,
            toDate,
            company: company || null,
            location: location || null,
            type,
            workingHours: type === 'Full Day Off' ? 0 : (workingHours || 9)
        };

        const override = await WorkingDayOverride.findByIdAndUpdate(req.params.id, updatedData, {
            new: true,
            runValidators: true
        });

        if (!override) {
            return res.status(404).json({ success: false, message: 'Override not found' });
        }

        res.status(200).json({ success: true, data: override });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete an override
// @route   DELETE /api/settings/overrides/:id
// @access  Private (Admin/HR)
exports.deleteOverride = async (req, res, next) => {
    try {
        const override = await WorkingDayOverride.findByIdAndDelete(req.params.id);

        if (!override) {
            return res.status(404).json({ success: false, message: 'Override not found' });
        }

        res.status(200).json({ success: true, message: 'Override deleted successfully' });
    } catch (error) {
        next(error);
    }
};
