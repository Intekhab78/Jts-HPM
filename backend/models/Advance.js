const mongoose = require('mongoose');

const advanceSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        requestDate: {
            type: Date,
            default: Date.now
        },
        amount: {
            type: Number,
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        emiMonths: {
            type: Number,
            required: true,
            min: 1
        },
        emiAmount: {
            type: Number, // Computed: amount / emiMonths
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Disbursed', 'Completed'],
            default: 'Pending'
        },
        repaymentStartDate: {
            type: Date // Month to start deduction
        },
        amountRepaid: {
            type: Number,
            default: 0
        },
        remarks: {
            type: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Advance', advanceSchema);
