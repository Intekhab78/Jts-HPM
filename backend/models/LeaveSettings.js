const mongoose = require('mongoose');

const designationLimitSchema = new mongoose.Schema({
    designation: { type: String, required: true },
    maxDays: { type: Number, required: true }
});

const leaveSettingsSchema = new mongoose.Schema({
    // Using a singleton pattern by defaulting to a specific ID if multi-tenant is not fully scaled
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null
    },

    // Core Allocations
    annualLeaveDays: { type: Number, default: 30 },
    sickLeaveDays: { type: Number, default: 90 },
    maternityLeaveDays: { type: Number, default: 60 },
    paternityLeaveDays: { type: Number, default: 5 },

    // Probation Rules
    allowAnnualLeaveDuringProbation: { type: Boolean, default: false },

    // Carry Forward
    enableCarryForward: { type: Boolean, default: false },
    defaultMaxCarryForwardDays: { type: Number, default: 15 },
    designationCarryForwardLimits: [designationLimitSchema],

    // Encashment
    enableLeaveEncashment: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('LeaveSettings', leaveSettingsSchema);
