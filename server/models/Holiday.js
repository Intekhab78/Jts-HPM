const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Holiday name is required'],
            trim: true
        },
        date: {
            type: Date,
            required: [true, 'Holiday date is required']
        },
        type: {
            type: String,
            enum: ['Public', 'Company'],
            default: 'Public'
        },
        isPaid: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

// Prevent duplicate holidays on the exact same date
holidaySchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
