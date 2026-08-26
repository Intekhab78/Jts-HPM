const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Location name is required'],
            unique: true,
            trim: true
        },
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Location must belong to a Company']
        },
        address: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email'
            ]
        },
        contactNo: {
            type: String,
            trim: true
        },
        lat: {
            type: Number
        },
        lng: {
            type: Number
        },
        radius: {
            type: Number,
            default: 100 // in meters
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Location', locationSchema);
