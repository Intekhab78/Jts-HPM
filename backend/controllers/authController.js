const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');

// Generate tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });

    const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRE,
    });

    return { accessToken, refreshToken };
};

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const user = await User.create({ name, email, password, role: role || 'employee' });

        const { accessToken, refreshToken } = generateTokens(user._id);

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        // Populate role for frontend
        await user.populate('role');

        res.status(201).json({
            success: true,
            data: {
                user,
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email or employee ID and password' });
        }

        console.log(`[LOGIN ATTEMPT] Identity: '${email}' (len: ${email.length}) | Pwd: '${password}' (len: ${password.length})`);

        let user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

        // If not found by email, try treating it as an Employee ID
        if (!user && !email.includes('@')) {
            const emp = await Employee.findOne({ employeeId: { $regex: new RegExp(`^${email}$`, 'i') } });
            if (emp) {
                user = await User.findOne({ employeeRef: emp._id }).select('+password');
            }
        }

        if (!user) {
            console.log(`[LOGIN FAILED] User not found for email: ${email}`);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`[LOGIN FAILED] Password mismatch for email: ${email}`);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Account has been deactivated' });
        }

        const { accessToken, refreshToken } = generateTokens(user._id);

        user.refreshToken = refreshToken;
        await user.save();

        // Populate for frontend response
        await user.populate('role');
        await user.populate('employeeRef');

        // Check if user manages anyone
        let isManager = false;
        if (user.employeeRef) {
            const subs = await Employee.countDocuments({ manager: user.employeeRef._id });
            isManager = subs > 0;
        }

        const userData = user.toObject();
        delete userData.password;
        userData.isManager = isManager;

        // Pass Profile Photo explicitly to frontend session
        if (user.employeeRef && user.employeeRef.profilePhoto) {
            userData.profilePhoto = user.employeeRef.profilePhoto;
        }

        res.status(200).json({
            success: true,
            data: {
                user: userData,
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('employeeRef').populate('role');

        let isManager = false;
        if (user.employeeRef) {
            const subs = await Employee.countDocuments({ manager: user.employeeRef._id });
            isManager = subs > 0;
        }

        const userData = user.toObject();
        userData.isManager = isManager;

        // Pass Profile Photo explicitly to frontend session
        if (user.employeeRef && user.employeeRef.profilePhoto) {
            userData.profilePhoto = user.employeeRef.profilePhoto;
        }

        res.status(200).json({ success: true, data: userData });
    } catch (error) {
        next(error);
    }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token required' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id).select('+refreshToken').populate('role');

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        const tokens = generateTokens(user._id);
        user.refreshToken = tokens.refreshToken;
        await user.save();

        res.status(200).json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
        });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
};

// @desc    Logout
// @route   POST /api/auth/logout
exports.logout = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
        res.status(200).json({ success: true, message: 'Logged out' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all users (admin only)
// @route   GET /api/auth/users
exports.getUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-refreshToken').populate('role');
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user role (admin only)
// @route   PUT /api/auth/users/:id/role
exports.updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body; // Expects an ObjectId now

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Prevent users from changing their own role (optional security)
        if (req.user.id === user._id.toString() && role !== user.role) {
            return res.status(403).json({ success: false, message: 'You cannot change your own role' });
        }

        user.role = role;
        await user.save();

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// @desc    Change password (self-service)
// @route   PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect current password' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin reset employee password
// @route   PUT /api/auth/users/:id/reset-password
exports.resetUserPassword = async (req, res, next) => {
    try {
        const { newPassword } = req.body;

        const user = await User.findById(req.params.id).populate('role');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.role?.name === 'admin') {
            return res.status(403).json({ success: false, message: 'Cannot reset the password of an Admin account from this panel' });
        }

        user.password = newPassword || 'password123';
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        next(error);
    }
};
