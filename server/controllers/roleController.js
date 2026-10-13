const Role = require('../models/Role');

// @desc    Get all roles
// @route   GET /api/roles
// @access  Admin
exports.getRoles = async (req, res, next) => {
    try {
        const roles = await Role.find();
        res.status(200).json({ success: true, count: roles.length, data: roles });
    } catch (error) {
        next(error);
    }
};

// @desc    Update role permissions
// @route   PUT /api/roles/:id/permissions
// @access  Admin
exports.updateRolePermissions = async (req, res, next) => {
    try {
        const { permissions } = req.body;

        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        // We can optionally prevent admin from losing its own core permissions here,
        // but for now, we just update.

        role.permissions = permissions;
        await role.save();

        res.status(200).json({ success: true, data: role });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new custom role
// @route   POST /api/roles
// @access  Admin
exports.createRole = async (req, res, next) => {
    try {
        const { name, description, permissions } = req.body;

        const existing = await Role.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Role name already exists' });
        }

        const role = await Role.create({
            name,
            description,
            permissions: permissions || []
        });

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Admin
exports.deleteRole = async (req, res, next) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        if (role.isSystem) {
            return res.status(403).json({ success: false, message: 'Cannot delete a system role' });
        }

        await role.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
