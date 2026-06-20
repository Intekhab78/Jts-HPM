const mongoose = require('mongoose');

const attendanceSettingsSchema = new mongoose.Schema({
    // Office Hours
    officeStartTime: { type: String, default: '09:00' },
    officeEndTime: { type: String, default: '18:00' },
    expectedWorkingHours: { type: Number, default: 9 },

    // Late Marking
    lateMarkingEnabled: { type: Boolean, default: true },
    lateGraceMinutes: { type: Number, default: 15 },

    // Overtime
    overtimeEnabled: { type: Boolean, default: true },
    otMinimumMinutes: { type: Number, default: 60 },

    // Half Day Threshold (auto = expectedWorkingHours * 60 / 2)
    halfDayThresholdMinutes: { type: Number, default: null }
}, {
    timestamps: true
});

module.exports = mongoose.model('AttendanceSettings', attendanceSettingsSchema);
