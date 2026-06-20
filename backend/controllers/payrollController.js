const Payroll = require('../models/Payroll');
const payrollService = require('../services/payrollService');
const { initiateApproval } = require('../services/approvalService');

// @desc    Get payroll history/records for a specific period
// @route   GET /api/payroll
// @access  Private (Admin, HR, Manager)
exports.getPayrolls = async (req, res, next) => {
    try {
        const { year, month } = req.query;
        let query = {};

        if (year && month) {
            query.year = year;
            query.month = month;
        }

        const payrolls = await Payroll.find(query)
            .populate('employee', 'employeeId firstName lastName department designation')
            .sort({ year: -1, month: -1 });

        res.status(200).json({ success: true, count: payrolls.length, data: payrolls });
    } catch (error) {
        next(error);
    }
};

// @desc    Run payroll generation for a month
// @route   POST /api/payroll/generate
// @access  Private (Admin, HR)
exports.generatePayroll = async (req, res, next) => {
    try {
        const { year, month, companyId } = req.body;
        if (!year || !month) return res.status(400).json({ success: false, message: 'Year and Month required' });

        // Check if payroll is frozen for this period
        const frozenRecord = await Payroll.findOne({ month, year, isFrozen: true });
        if (frozenRecord) {
            return res.status(403).json({ success: false, message: 'Payroll for this period is frozen. Unfreeze it first to make changes.' });
        }

        const records = await payrollService.generatePayroll(month, year, req.user.id, companyId);

        res.status(200).json({ success: true, count: records.length, data: records });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Gratuity for employee
// @route   GET /api/payroll/gratuity/:employeeId
// @access  Private (Admin, HR, Employee for self)
exports.getGratuity = async (req, res, next) => {
    try {
        const result = await payrollService.calculateGratuity(req.params.employeeId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate WPS SIF payload file
// @route   POST /api/payroll/sif
// @access  Private (Admin, Finance)
exports.downloadSIF = async (req, res, next) => {
    try {
        const { year, month } = req.body;
        if (!year || !month) return res.status(400).json({ success: false, message: 'Year and Month required' });

        const downloadUrl = await payrollService.generateWpsSif(month, year);
        res.status(200).json({ success: true, data: { downloadUrl } });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Generate and get Payslip PDF for specific record
// @route   GET /api/payroll/:id/payslip
// @access  Private (Admin, HR, Employee)
exports.downloadPayslip = async (req, res, next) => {
    try {
        const payroll = await Payroll.findById(req.params.id);
        if (!payroll) return res.status(404).json({ success: false, message: 'Not found' });

        // Authorization check: Employees can only download their own
        if (req.user.role === 'employee' && req.user.employeeRef.toString() !== payroll.employee.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const downloadUrl = await payrollService.generatePayslipPdf(req.params.id);
        res.status(200).json({ success: true, data: { downloadUrl } });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Payroll Status (e.g. Draft -> Approved)
// @route   PUT /api/payroll/:id/status
// @access  Private (Admin, HR, Finance)
exports.updatePayrollStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const payroll = await Payroll.findById(req.params.id);

        if (!payroll) return res.status(404).json({ success: false, message: 'Not found' });

        // Check if payroll is frozen
        if (payroll.isFrozen) {
            return res.status(403).json({ success: false, message: 'This payroll record is frozen. Unfreeze it first to make changes.' });
        }

        payroll.status = status;
        await payroll.save();

        res.status(200).json({ success: true, data: payroll });
    } catch (error) {
        next(error);
    }
};

// @desc    Freeze payroll for a month/year (bulk)
// @route   PUT /api/payroll/freeze
// @access  Private (Admin, HR)
exports.freezePayroll = async (req, res, next) => {
    try {
        const year = parseInt(req.body.year);
        const month = parseInt(req.body.month);
        if (!year || !month) return res.status(400).json({ success: false, message: 'Year and Month required' });

        const result = await Payroll.updateMany(
            { month, year },
            { $set: { isFrozen: true, frozenBy: req.user._id, frozenAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'No payroll records found for this period' });
        }

        res.status(200).json({ success: true, message: `Frozen ${result.modifiedCount} payroll records for ${month}/${year}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Unfreeze payroll for a month/year (bulk)
// @route   PUT /api/payroll/unfreeze
// @access  Private (Admin, HR)
exports.unfreezePayroll = async (req, res, next) => {
    try {
        const year = parseInt(req.body.year);
        const month = parseInt(req.body.month);
        if (!year || !month) return res.status(400).json({ success: false, message: 'Year and Month required' });

        const result = await Payroll.updateMany(
            { month, year },
            { $set: { isFrozen: false }, $unset: { frozenBy: 1, frozenAt: 1 } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'No payroll records found for this period' });
        }

        res.status(200).json({ success: true, message: `Unfrozen ${result.modifiedCount} payroll records for ${month}/${year}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Get distinct frozen month/year periods
// @route   GET /api/payroll/frozen-months
// @access  Private (Admin, HR, Finance)
exports.getFrozenMonths = async (req, res, next) => {
    try {
        const frozenPeriods = await Payroll.aggregate([
            { $match: { isFrozen: true } },
            { $group: { _id: { month: '$month', year: '$year' } } },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $project: { _id: 0, month: '$_id.month', year: '$_id.year' } }
        ]);

        res.status(200).json({ success: true, data: frozenPeriods });
    } catch (error) {
        next(error);
    }
};
