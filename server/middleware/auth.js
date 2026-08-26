const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - JWT verification
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).populate('role');

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        if (!req.user.isActive) {
            return res.status(401).json({ success: false, message: 'Account deactivated' });
        }

        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
    }
};

// Role-based access for legacy string roles (kept for partial backward compatibility during transition if needed)
const authorize = (...roles) => {
    return async (req, res, next) => {
        try {
            const roleName = req.user?.role?.name || req.user?.role;
            const hasDirectRole = roles.includes(roleName);

            let hasManagerFlag = false;

            if (roles.includes('manager') && req.user?.employeeRef) {
                // Determine manager status dynamically since it's not on the model
                const Employee = require('../models/Employee');
                const subs = await Employee.countDocuments({ manager: req.user.employeeRef._id });
                hasManagerFlag = subs > 0;
            }

            if (!req.user || (!hasDirectRole && !hasManagerFlag)) {
                return res.status(403).json({
                    success: false,
                    message: `User is not authorized for this action`,
                });
            }
            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({ success: false, message: 'Server error during authorization' });
        }
    };
};

// Strict Admin Checker (for Role APIs)
const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.role && req.user.role.name === 'admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
};

module.exports = { protect, authorize, authorizeAdmin };
