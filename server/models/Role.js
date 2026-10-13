const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
    view: { type: Boolean, default: false },
    modify: { type: Boolean, default: false }, // Add/Edit
    delete: { type: Boolean, default: false },
    approve: { type: Boolean, default: false }  // For workflows
}, { _id: false });

const permissionSchema = new mongoose.Schema({
    module: { type: String, required: true }, // e.g., 'employees', 'leaves', 'payroll', 'attendance', 'roles'
    actions: { type: actionSchema, default: () => ({}) }
}, { _id: false });

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true // store 'admin', display 'Admin'
    },
    description: {
        type: String
    },
    permissions: [permissionSchema],
    isSystem: {
        type: Boolean,
        default: false // Set to true for core 'admin' to prevent accidental deletion
    }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
