const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Company name is required'],
            unique: true,
            trim: true
        },
        logo: {
            type: String
        },
        tagline: {
            type: String
        },
        tradeLicenseNo: {
            type: String,
            trim: true
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
        website: {
            type: String,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        allowPunchOutsideGeofence: {
            type: Boolean,
            default: false
        },
        allowOpenAttendance: {
            type: Boolean,
            default: false
        },
        enableOvertime: {
            type: Boolean,
            default: false
        },
        overtimeRules: {
            ruleType: {
                type: String,
                enum: ['Designation', 'Employee'],
                default: 'Designation'
            },
            designationRules: [{
                designation: { type: String, required: true },
                normalRate: { type: Number, default: 1.25 },
                holidayRate: { type: Number, default: 1.50 }
            }],
            employeeRules: [{
                employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
                normalRate: { type: Number, default: 1.25 },
                holidayRate: { type: Number, default: 1.50 }
            }]
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
