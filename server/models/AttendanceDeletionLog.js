const mongoose = require('mongoose');

const attendanceDeletionLogSchema = new mongoose.Schema(
    {
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        type: {
            type: String,
            enum: ['DailyRecord', 'SinglePunch'],
            required: true
        },
        reason: {
            type: String,
            required: [true, 'Deletion reason is mandatory'],
            trim: true
        },
        attendanceDate: {
            type: Date,
            required: true
        },
        attendanceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attendance'
        },
        punchLogId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BiometricPunchLog'
        },
        snapshot: {
            type: Object,
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AttendanceDeletionLog', attendanceDeletionLogSchema);
