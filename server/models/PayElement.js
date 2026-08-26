const mongoose = require('mongoose');

const payElementSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        type: { type: String, enum: ['Earning', 'Deduction'], default: 'Earning' },
        description: { type: String },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('PayElement', payElementSchema);
