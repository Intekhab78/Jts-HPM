const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        leaveType: {
            type: String,
            enum: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Hajj', 'Unpaid', 'Compassionate', 'Encashment'],
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
        totalDays: {
            type: Number,
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
            default: 'Pending'
        },
        approvalFlow: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ApprovalFlow'
        },
        // Supporting document like sick leave certificate
        attachmentUrl: {
            type: String
        },
        appliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Leave', leaveSchema);
