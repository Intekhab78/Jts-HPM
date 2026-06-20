const mongoose = require('mongoose');

const kpiSchema = new mongoose.Schema({
    metric: { type: String, required: true },
    weight: { type: Number, required: true, min: 1, max: 100 },
    selfScore: { type: Number, min: 0, max: 5 }, // scale 1-5
    managerScore: { type: Number, min: 0, max: 5 }
}, { _id: false });

const appraisalSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User' // Assuming User model has the login for the manager
        },
        period: {
            type: String,
            required: true // e.g., "Q1 2026", "2026 Annual"
        },
        type: {
            type: String,
            enum: ['Annual', 'Probation', 'Project'],
            required: true
        },
        kpis: [kpiSchema],
        overallRating: {
            type: Number, // Computed average out of 5 based on weights
            min: 0,
            max: 5
        },
        selfComments: { type: String },
        managerComments: { type: String },
        hrComments: { type: String },
        incrementRecommendation: { type: Number }, // Suggested % salary bump
        status: {
            type: String,
            enum: ['Draft', 'Self-Assessment', 'Manager Review', 'HR Review', 'Finalized'],
            default: 'Draft'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Appraisal', appraisalSchema);
