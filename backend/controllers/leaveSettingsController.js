const LeaveSettings = require('../models/LeaveSettings');

// @desc    Get Leave Settings
// @route   GET /api/leave-settings
// @access  Private
exports.getSettings = async (req, res, next) => {
    try {
        let settings = await LeaveSettings.findOne(); // Singleton for now

        if (!settings) {
            // Create default settings if none exist
            settings = await LeaveSettings.create({});
        }

        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Leave Settings
// @route   PUT /api/leave-settings
// @access  Private (Admin only)
exports.updateSettings = async (req, res, next) => {
    try {
        let settings = await LeaveSettings.findOne();

        if (!settings) {
            settings = await LeaveSettings.create(req.body);
        } else {
            settings = await LeaveSettings.findByIdAndUpdate(
                settings._id,
                req.body,
                { new: true, runValidators: true }
            );
        }

        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};
