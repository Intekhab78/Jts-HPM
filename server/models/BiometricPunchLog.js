const mongoose = require('mongoose');

const biometricPunchLogSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        timestamp: {
            type: Date,
            required: true,
            default: Date.now
        },
        punchMethod: {
            type: String,
            enum: ['Face', 'PIN', 'Finger', 'QR', 'GPS-Selfie', 'Manual', 'IP-Camera'],
            default: 'Face'
        },
        punchType: {
            type: String,
            enum: ['in', 'out', 'auto'],
            default: 'auto'
        },
        photoPath: {
            type: String
        },
        location: {
            lat: Number,
            lng: Number
        },
        kioskDevice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Device'
        },
        faceMatchScore: {
            type: Number
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('BiometricPunchLog', biometricPunchLogSchema);
