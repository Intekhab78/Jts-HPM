const mongoose = require('mongoose');

const advanceSettlementSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        travelRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TravelRequest',
            required: true
        },
        expenses: [{
            date: {
                type: Date,
                required: true,
                default: Date.now
            },
            category: {
                type: String,
                enum: ['Airfare', 'Hotel', 'Meals', 'Local Transport', 'Visa', 'Client Entertainment', 'Other'],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            currency: {
                type: String,
                default: 'AED'
            },
            description: {
                type: String,
                required: true
            },
            receiptUrl: {
                type: String
            },
            status: {
                type: String,
                enum: ['Pending', 'Approved', 'Rejected', 'Draft'],
                default: 'Pending'
            },
            comments: {
                type: String
            }
        }],
        totalAmount: {
            type: Number,
            required: true,
            default: 0
        },
        balance: {
            type: Number,
            required: true,
            default: 0 // positive = employee owes company, negative = company owes employee
        },
        additionalAmountRequested: {
            type: Number,
            default: 0 // Explicit extra amount employee is claiming if expenses > advance
        },
        status: {
            type: String,
            enum: ['Draft', 'Pending Manager', 'Pending Finance', 'Approved', 'Rejected'],
            default: 'Draft' // Now defaults to Draft
        },
        deductFromSalary: {
            type: Boolean,
            default: false // Finance can flag this to instruct HR to deduct balance from salary
        },
        managerApprovalDate: {
            type: Date
        },
        financeApprovalDate: {
            type: Date
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AdvanceSettlement', advanceSettlementSchema);
