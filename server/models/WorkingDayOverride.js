const mongoose = require('mongoose');

const workingDayOverrideSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Please add a title for this override (e.g., Ramadan 2024, Heavy Rain)'],
            trim: true
        },
        fromDate: {
            type: Date,
            required: [true, 'Please add a start date']
        },
        toDate: {
            type: Date,
            required: [true, 'Please add an end date']
        },
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            default: null // If null, applies to all companies
        },
        location: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location',
            default: null // If null, applies to all locations
        },
        type: {
            type: String,
            enum: ['Shortened Hours', 'Half Day Off', 'Full Day Off'],
            required: true
        },
        workingHours: {
            type: Number,
            default: 9 // Standard UAE working hours. Can be overridden (e.g., to 6 for Ramadan)
        }
    },
    {
        timestamps: true
    }
);

// Index for efficient querying by date ranges
workingDayOverrideSchema.index({ fromDate: 1, toDate: 1 });

module.exports = mongoose.model('WorkingDayOverride', workingDayOverrideSchema);
