const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const leaveService = require('../services/leaveService');

// @desc    Get all leaves (for HR/Admin)
// @route   GET /api/leaves
// @access  Private
exports.getAllLeaves = async (req, res, next) => {
    try {
        let query = {};
        const role = req.user.role?.name || req.user.role;

        // If not admin or hr, strict filter to subordinates only
        if (role !== 'admin' && role !== 'hr' && role !== 'director') {
            const myEmployees = await Employee.find({ manager: req.user.employeeRef }).select('_id');
            const empIds = myEmployees.map(e => e._id);
            query = { employee: { $in: empIds } };
        }

        const leaves = await Leave.find(query)
            .populate('employee', 'firstName lastName employeeId department designation manager')
            .populate('approvalFlow')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: leaves.length, data: leaves });
    } catch (error) {
        next(error);
    }
};

// @desc    Get employee leaves (history)
// @route   GET /api/leaves/employee/:employeeId
// @access  Private
exports.getEmployeeLeaves = async (req, res, next) => {
    try {
        // Validation: Employee can only see own leaves, unless manager/HR/Admin
        const leaves = await Leave.find({ employee: req.params.employeeId })
            .populate('approvalFlow')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: leaves.length, data: leaves });
    } catch (error) {
        next(error);
    }
};

// @desc    Get leave balances 
// @route   GET /api/leaves/balance/:employeeId
// @access  Private
exports.getLeaveBalances = async (req, res, next) => {
    try {
        const balances = await leaveService.getLeaveBalance(req.params.employeeId);
        res.status(200).json({ success: true, data: balances });
    } catch (error) {
        next(error);
    }
};

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private
exports.applyForLeave = async (req, res, next) => {
    try {
        const leaveData = req.body;
        // if employee applies for themselves, ensure employee ID matches their profile
        if (req.user.role === 'employee' && req.user.employeeRef.toString() !== leaveData.employee) {
            return res.status(403).json({ success: false, message: 'Not authorized to apply leave for another employee' });
        }

        const leaveResponse = await leaveService.applyLeave(leaveData, req.user.id, req.user.role);
        res.status(201).json({ success: true, data: leaveResponse });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update/Cancel leave
// @route   PUT /api/leaves/:id
// @access  Private
exports.updateLeave = async (req, res, next) => {
    try {
        let leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave record not found' });
        }

        // only allow updates if pending
        if (leave.status !== 'Pending' && req.user.role !== 'admin' && req.user.role !== 'hr') {
            return res.status(400).json({ success: false, message: 'Cannot update a processed leave' });
        }

        leave = await Leave.findByIdAndUpdate(req.params.id, req.body, {
            new: true, runValidators: true
        });

        res.status(200).json({ success: true, data: leave });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload leave attachment (like Sick Leave certificate)
// @route   POST /api/leaves/:id/attachment
// @access  Private
exports.uploadAttachment = async (req, res, next) => {
    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave record not found' });
        }

        if (!req.files || !req.files.attachment) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        leave.attachmentUrl = `/uploads/leaves/${req.files.attachment[0].filename}`;
        await leave.save();

        res.status(200).json({ success: true, data: leave });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete/Cancel leave
// @route   DELETE /api/leaves/:id
// @access  Private
exports.deleteLeave = async (req, res, next) => {
    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave record not found' });
        }

        // Only allow deletion if pending, and only by the employee or admin/hr
        if (leave.status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Only pending leaves can be canceled' });
        }

        if (req.user.role === 'employee' && req.user.employeeRef.toString() !== leave.employee.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to cancel this leave' });
        }

        await leave.deleteOne();

        res.status(200).json({ success: true, message: 'Leave canceled successfully' });
    } catch (error) {
        next(error);
    }
};
