const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        month: {
            type: Number, // 1 for Jan, 2 for Feb, etc.
            required: true
        },
        year: {
            type: Number,
            required: true
        },
        earnings: {
            basic: { type: Number, default: 0 },
            allowances: [{
                name: { type: String },
                amount: { type: Number }
            }],
            overtime: { type: Number, default: 0 },
            bonus: { type: Number, default: 0 }
        },
        deductions: {
            leaveDeduction: { type: Number, default: 0 }, // Unpaid leave, or sick leave deduction
            lateDeduction: { type: Number, default: 0 },
            loanEMI: { type: Number, default: 0 },
            otherDeductions: { type: Number, default: 0 },
            advanceRecoveryDeduction: { type: Number, default: 0 }
        },
        grossPay: {
            type: Number,
            required: true
        },
        totalDeductions: {
            type: Number,
            required: true
        },
        netPay: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Draft', 'Reviewed', 'Processing', 'Approved', 'Paid'],
            default: 'Draft'
        },
        paymentMethod: {
            type: String,
            enum: ['Bank Transfer', 'Cheque', 'Cash'],
            default: 'Bank Transfer'
        },
        approvalFlow: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ApprovalFlow'
        },
        remarks: {
            type: String
        },
        isFrozen: {
            type: Boolean,
            default: false
        },
        frozenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        frozenAt: {
            type: Date
        }
    },
    { timestamps: true }
);

// Ensures an employee is not paid multiple times for the same month
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
