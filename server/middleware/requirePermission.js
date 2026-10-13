const requirePermission = (module, action) => {
    return (req, res, next) => {
        // Protect against null users or roles
        if (!req.user || !req.user.role || !req.user.role.permissions) {
            return res.status(403).json({ success: false, message: 'Access denied: No role assigned' });
        }

        const role = req.user.role;

        // System admins bypass module-level checks
        if (role.name === 'admin' && role.isSystem) {
            return next();
        }

        // Find module permissions
        const modPerm = role.permissions.find(p => p.module === module);

        if (!modPerm || !modPerm.actions[action]) {
            return res.status(403).json({
                success: false,
                message: `You do not have permission to ${action} ${module}`
            });
        }

        next();
    };
};

module.exports = requirePermission;
