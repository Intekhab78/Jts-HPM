const mongoose = require('mongoose');

const travelRequestSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        purpose: {
            type: String,
            required: true
        },
        destination: {
            type: String,
            required: true
        },
        fromDate: {
            type: Date,
            required: true
        },
        toDate: {
            type: Date,
            required: true
        },
        estimatedBudget: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'AED'
        },
        status: {
            type: String,
            enum: ['Pending', 'Pending Finance', 'Approved', 'Rejected', 'Completed'],
            default: 'Pending'
        },
        notes: {
            type: String
        },
        // --- Advance Tracking & Attachments ---
        requestedAdvance: {
            type: Number,
            default: 0
        },
        approvedAdvance: {
            type: Number,
            default: 0
        },
        advanceDocumentUrl: {
            type: String // URL/Path to the uploaded document against the advance
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('TravelRequest', travelRequestSchema);
