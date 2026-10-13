const mongoose = require('mongoose');

const shiftScheduleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        startTime: {
            type: String, // e.g. "09:00"
            required: true
        },
        endTime: {
            type: String, // e.g. "18:00"
            required: true
        },
        lunchDuration: {
            type: Number, // in minutes
            default: 30
        },
        lateGracePeriod: {
            type: Number, // in minutes
            default: 15
        },
        earlyGracePeriod: {
            type: Number, // in minutes
            default: 30
        },
        workingType: {
            type: String,
            enum: ['Standard', 'Flexi'],
            default: 'Standard'
        },
        flexiHoursLimit: {
            type: Number, // in hours
            default: 8
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ShiftSchedule', shiftScheduleSchema);
