const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        checkIn: {
            type: Date
        },
        checkOut: {
            type: Date
        },
        status: {
            type: String,
            enum: ['Present', 'Absent', 'Late', 'Half Day', 'Public Holiday', 'Weekend', 'On Leave'],
            required: true
        },
        overtimeHours: {
            type: Number,
            default: 0
        },
        holidayOvertimeHours: {
            type: Number,
            default: 0
        },
        lateMinutes: {
            type: Number,
            default: 0
        },
        source: {
            type: String,
            enum: ['Manual', 'Biometric', 'Excel', 'API'],
            default: 'Manual'
        },
        // Biometric & Geo-location data
        punchInLocation: {
            lat: { type: Number },
            lng: { type: Number }
        },
        punchOutLocation: {
            lat: { type: Number },
            lng: { type: Number }
        },
        punchInPhoto: { type: String }, // path to saved webcam image
        punchOutPhoto: { type: String },
        faceMatchScore: { type: Number },
        faceMatchFailed: { type: Boolean, default: false },
        // Multi-level Approval
        approvalStatus: {
            type: String,
            enum: ['Pending Manager', 'Pending HR', 'Approved', 'Rejected', 'Auto-Approved'],
            default: 'Auto-Approved' // Manual/Excel entries are assumed Auto-Approved.
        },
        // Employee Requests (Missed Punch / Manual)
        isRequestPending: {
            type: Boolean,
            default: false
        },
        requestType: {
            type: String,
            enum: ['Missed Punch', 'Manual Entry']
        },
        requestedCheckIn: { type: Date },
        requestedCheckOut: { type: Date },
        requestReason: { type: String },
        isLocked: {
            type: Boolean,
            default: false // Used to lock attendance when payroll is processed
        }
    },
    { timestamps: true }
);

// Ensure an employee only has one attendance record per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
