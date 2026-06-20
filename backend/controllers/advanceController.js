const Advance = require('../models/Advance');

// @desc    Get all advances
// @route   GET /api/advance
// @access  Private
exports.getAdvances = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role === 'employee') {
            query.employee = req.user.employeeRef;
        }

        const advances = await Advance.find(query)
            .populate('employee', 'firstName lastName employeeId department basicSalary')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: advances.length, data: advances });
    } catch (error) {
        next(error);
    }
};

// @desc    Apply for an Advance
// @route   POST /api/advance
// @access  Private
exports.createAdvance = async (req, res, next) => {
    try {
        // Body needs: amount, reason, emiMonths
        const emiAmount = parseFloat((req.body.amount / req.body.emiMonths).toFixed(2));

        const advanceData = {
            ...req.body,
            employee: req.user.employeeRef || req.body.employee,
            emiAmount
        };

        const advance = await Advance.create(advanceData);
        res.status(201).json({ success: true, data: advance });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Advance Status
// @route   PUT /api/advance/:id/status
// @access  Private (Admin/Finance/HR)
exports.updateAdvanceStatus = async (req, res, next) => {
    try {
        const { status, repaymentStartDate } = req.body;

        let updateData = { status };
        // If disbursed, log the start date for EMIs
        if (status === 'Disbursed' && repaymentStartDate) {
            updateData.repaymentStartDate = repaymentStartDate;
        }

        const advance = await Advance.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        if (!advance) return res.status(404).json({ success: false, message: 'Not found' });

        res.status(200).json({ success: true, data: advance });
    } catch (error) {
        next(error);
    }
};
