const mongoose = require('mongoose');

const leaveEncashmentSchema = new mongoose.Schema(
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
        leaveType: {
            type: String,
            default: 'Annual'
        },
        daysEncashed: {
            type: Number,
            required: true
        },
        basicSalary: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Processed'],
            default: 'Pending'
        },
        remarks: {
            type: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('LeaveEncashment', leaveEncashmentSchema);
