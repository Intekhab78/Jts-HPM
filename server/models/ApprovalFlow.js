const mongoose = require('mongoose');

const approvalLevelSchema = new mongoose.Schema({
    level: { type: Number, required: true },
    role: {
        type: String,
        enum: ['manager', 'department_head', 'hr', 'finance', 'director', 'admin'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    comments: { type: String, default: '' },
    actionDate: { type: Date, default: null },
});

const approvalFlowSchema = new mongoose.Schema({
    module: {
        type: String,
        enum: ['leave', 'expense', 'advance', 'payroll', 'appraisal', 'onboarding', 'bank_update',
            'Leave', 'Expense', 'Advance', 'Payroll', 'Appraisal', 'Onboarding', 'BankUpdate'],
        required: true,
    },
    documentRef: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'module',
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    levels: [approvalLevelSchema],
    currentLevel: {
        type: Number,
        default: 0,
    },
    overallStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'approved', 'rejected'],
        default: 'pending',
    },
}, {
    timestamps: true,
});

// Index for quick lookups
approvalFlowSchema.index({ module: 1, documentRef: 1 });
approvalFlowSchema.index({ overallStatus: 1 });
approvalFlowSchema.index({ 'levels.role': 1, 'levels.status': 1 });

module.exports = mongoose.model('ApprovalFlow', approvalFlowSchema);
