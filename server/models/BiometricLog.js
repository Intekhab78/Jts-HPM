const mongoose = require('mongoose');

const biometricLogSchema = new mongoose.Schema(
    {
        biometricId: {
            type: String,
            required: true,
            trim: true
        },
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        timestamp: {
            type: Date,
            required: true
        },
        deviceBrand: {
            type: String,
            enum: ['ZKTeco', 'Hikvision', 'Amico', 'Generic'],
            default: 'Generic'
        },
        deviceName: {
            type: String,
            trim: true
        },
        deviceIp: {
            type: String,
            trim: true
        },
        type: {
            type: String,
            enum: ['Check-In', 'Check-Out', 'Punch'],
            default: 'Punch'
        },
        status: {
            type: String,
            enum: ['Pending', 'Processed', 'Failed'],
            default: 'Pending'
        },
        rawPayload: {
            type: mongoose.Schema.Types.Mixed
        },
        errorMessage: {
            type: String
        }
    },
    { timestamps: true }
);

// Index for query speed on logs
biometricLogSchema.index({ biometricId: 1, timestamp: -1 });

module.exports = mongoose.model('BiometricLog', biometricLogSchema);
