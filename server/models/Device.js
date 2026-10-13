const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    imeiNo: {
        type: String,
        unique: true,
        sparse: true
    },
    deviceType: {
        type: String,
        enum: ['Kiosk', 'IPCamera', 'ZKTeco'],
        default: 'Kiosk'
    },
    zoneGroup: {
        type: String,
        default: 'Main Area' // Groups multiple cameras covering the same area / gate
    },
    streamUrl: {
        type: String // Full RTSP / HTTP stream connection string
    },
    cameraIp: {
        type: String
    },
    cameraPort: {
        type: Number,
        default: 554
    },
    cameraUsername: {
        type: String
    },
    cameraPassword: {
        type: String
    },
    channelNo: {
        type: Number,
        default: 1
    },
    streamProfile: {
        type: String,
        enum: ['main', 'sub'],
        default: 'sub'
    },
    direction: {
        type: String,
        enum: ['in', 'out', 'auto'],
        default: 'auto'
    },
    isStreamingActive: {
        type: Boolean,
        default: false
    },
    cooldownMinutes: {
        type: Number,
        default: 5 // Cooldown in minutes before same employee can trigger another punch on this camera/zone
    },
    loginCredentials: {
        email: {
            type: String,
            unique: true,
            sparse: true
        },
        password: {
            type: String
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    cameraRole: {
        type: String,
        enum: ['FaceRecognition', 'SecuritySurveillance', 'Hybrid', 'RestrictedArea'],
        default: 'Hybrid'
    },
    enableTwoWayAudio: {
        type: Boolean,
        default: true
    },
    securityMonitoring: {
        alertUnrecognizedFaces: { type: Boolean, default: true },
        alertAfterHours: { type: Boolean, default: true },
        afterHoursStart: { type: String, default: '20:00' },
        afterHoursEnd: { type: String, default: '06:00' },
        alertBlacklist: { type: Boolean, default: true },
        alertCameraOffline: { type: Boolean, default: true },
        notifyEmails: [{ type: String }],
        notifyEmployees: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }]
    },
    recordingSchedule: {
        enabled: { type: Boolean, default: false },
        startHour: { type: String, default: '09:00' },
        durationHours: { type: Number, default: 8 }
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

deviceSchema.virtual('name').get(function() {
    if (this.description && this.description.trim()) {
        return this.description.trim();
    }
    return `${this.brand || 'Device'} ${this.model || ''}`.trim();
});

module.exports = mongoose.model('Device', deviceSchema);
