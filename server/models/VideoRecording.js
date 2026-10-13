const mongoose = require('mongoose');

const videoRecordingSchema = new mongoose.Schema({
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
    recordingType: {
        type: String,
        enum: ['Manual', 'Scheduled'],
        default: 'Manual'
    },
    filePath: {
        type: String,
        required: true
    },
    thumbnailPath: {
        type: String
    },
    fileSize: {
        type: Number,
        default: 0
    },
    durationSeconds: {
        type: Number,
        default: 0
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Recording', 'Completed', 'Failed'],
        default: 'Recording'
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('VideoRecording', videoRecordingSchema);
