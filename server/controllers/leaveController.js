const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const LeaveEncashment = require('../models/LeaveEncashment');
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

// @desc    Get all employee leave balances (for Admin/HR)
// @route   GET /api/leaves/balances
// @access  Private (Admin/HR)
exports.getAllEmployeeLeaveBalances = async (req, res, next) => {
    try {
        console.log('--- GET /api/leaves/balances Request ---');
        console.log('User:', req.user?.email, 'Role:', req.user?.role?.name || req.user?.role);
        
        const employees = await Employee.find({ isActive: true }).select('firstName lastName employeeId department designation');
        console.log(`Found ${employees.length} active employees`);
        
        const data = [];
        
        for (const emp of employees) {
            try {
                const balances = await leaveService.getLeaveBalance(emp._id);
                data.push({
                    _id: emp._id,
                    employeeId: emp.employeeId,
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    department: emp.department,
                    designation: emp.designation,
                    balances
                });
            } catch (err) {
                console.error(`Error calculating leave balance for ${emp.employeeId}:`, err.message);
            }
        }
        
        console.log(`Successfully calculated balances for ${data.length} employees`);
        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('--- getAllEmployeeLeaveBalances Error ---', error);
        next(error);
    }
};

// @desc    Apply for Leave Encashment
// @route   POST /api/leaves/encash
// @access  Private
exports.requestLeaveEncashment = async (req, res, next) => {
    try {
        const { employee, daysEncashed, remarks } = req.body;

        if (!employee || !daysEncashed) {
            return res.status(400).json({ success: false, message: 'Employee ID and days to encash are required' });
        }

        // Verify the employee exists and fetch their basic salary
        const empRecord = await Employee.findById(employee);
        if (!empRecord) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        let basicSalary = empRecord.basicSalary || 0;
        if (basicSalary === 0 && empRecord.payElements) {
            const basicElement = empRecord.payElements.find(pe => pe.element?.name?.toLowerCase().includes('basic'));
            if (basicElement) {
                basicSalary = basicElement.amount || 0;
            }
        }

        if (basicSalary === 0) {
            return res.status(400).json({ success: false, message: 'Employee basic salary not configured. Cannot calculate encashment.' });
        }

        // Check leave balances
        const balances = await leaveService.getLeaveBalance(employee);
        const availableAnnual = balances.Annual?.available || 0;

        if (daysEncashed > availableAnnual) {
            return res.status(400).json({ success: false, message: `Insufficient annual leave balance. Available: ${availableAnnual.toFixed(1)} days.` });
        }

        const amount = parseFloat(((basicSalary / 30) * daysEncashed).toFixed(2));

        const encashment = await LeaveEncashment.create({
            employee,
            daysEncashed,
            basicSalary,
            amount,
            remarks: remarks || '',
            status: 'Pending'
        });

        res.status(201).json({ success: true, data: encashment });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all leave encashments
// @route   GET /api/leaves/encashments
// @access  Private
exports.getLeaveEncashments = async (req, res, next) => {
    try {
        let query = {};
        const role = req.user.role?.name || req.user.role;

        // If employee, only get their own requests
        if (role === 'employee' && req.user.employeeRef) {
            query = { employee: req.user.employeeRef };
        }

        const encashments = await LeaveEncashment.find(query)
            .populate('employee', 'employeeId firstName lastName department designation')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: encashments.length, data: encashments });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Leave Encashment Status
// @route   PUT /api/leaves/encashments/:id/status
// @access  Private (Admin/HR)
exports.updateLeaveEncashmentStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const encashment = await LeaveEncashment.findById(req.params.id);
        if (!encashment) {
            return res.status(404).json({ success: false, message: 'Leave encashment request not found' });
        }

        if (encashment.status === 'Processed') {
            return res.status(400).json({ success: false, message: 'Cannot modify a processed leave encashment' });
        }

        encashment.status = status;
        await encashment.save();

        res.status(200).json({ success: true, data: encashment });
    } catch (error) {
        next(error);
    }
};
