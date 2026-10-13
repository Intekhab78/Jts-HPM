const mongoose = require('mongoose');

const unregisteredFaceLogSchema = new mongoose.Schema(
    {
        device: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Device'
        },
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company'
        },
        location: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location'
        },
        zoneGroup: {
            type: String,
            default: 'Main Area'
        },
        cameraName: {
            type: String
        },
        locationName: {
            type: String
        },
        timestamp: {
            type: Date,
            required: true,
            default: Date.now
        },
        photoPath: {
            type: String,
            required: true
        },
        tag: {
            type: String,
            default: 'Unregistered Visitor'
        },
        notes: {
            type: String
        },
        visitorName: {
            type: String
        },
        status: {
            type: String,
            enum: ['Unregistered', 'Tagged', 'Converted to Employee', 'Ignored'],
            default: 'Unregistered'
        },
        convertedEmployee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('UnregisteredFaceLog', unregisteredFaceLogSchema);
