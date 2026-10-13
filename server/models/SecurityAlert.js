const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    cameraName: {
        type: String,
        required: true
    },
    locationName: {
        type: String,
        default: 'Main Office'
    },
    zoneGroup: {
        type: String,
        default: 'Main Area'
    },
    eventType: {
        type: String,
        enum: [
            'StrangerIntrusion',
            'BlacklistedPerson',
            'AfterHoursMovement',
            'CameraOffline',
            'VIPArrival',
            'TamperingAlert',
            'ManualAlert'
        ],
        default: 'StrangerIntrusion'
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    severity: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    snapshotPath: {
        type: String
    },
    videoClipPath: {
        type: String
    },
    personName: {
        type: String
    },
    employeeRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    faceMatchScore: {
        type: Number
    },
    status: {
        type: String,
        enum: ['Active', 'Acknowledged', 'Escalated', 'Resolved', 'FalseAlarm'],
        default: 'Active'
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedAt: {
        type: Date
    },
    resolutionNotes: {
        type: String
    },
    notifiedEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
