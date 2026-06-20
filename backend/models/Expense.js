const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        travelRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TravelRequest', // Optional: link to a specific approved trip
        },
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
            type: String // Path to uploaded receipt image/pdf
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Reimbursed'],
            default: 'Pending'
        },
        reimbursedDate: {
            type: Date
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
