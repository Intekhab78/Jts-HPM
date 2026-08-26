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

        payroll.status = status;
        await payroll.save();

        // Transaction updates when status is marked as 'Paid'
        if (status === 'Paid') {
            // 1. Advance / Loan repayments deduction tracking
            const totalEmiDeducted = payroll.deductions?.loanEMI || 0;
            if (totalEmiDeducted > 0) {
                const Advance = require('../models/Advance');
                // Find all active advances for this employee
                const activeAdvances = await Advance.find({
                    employee: payroll.employee,
                    status: 'Disbursed'
                });

                for (const adv of activeAdvances) {
                    if (adv.amountRepaid < adv.amount) {
                        let deduction = adv.emiAmount;
                        if (adv.amountRepaid + deduction > adv.amount) {
                            deduction = adv.amount - adv.amountRepaid;
                        }

                        adv.amountRepaid = parseFloat((adv.amountRepaid + deduction).toFixed(2));
                        if (adv.amountRepaid >= adv.amount) {
                            adv.status = 'Completed';
                        }
                        await adv.save();
                        console.log(`Deducted loan repayment: ${deduction} for ${payroll.employee}. New total: ${adv.amountRepaid}`);
                    }
                }
            }

            // 2. Mark Approved Leave Encashments as Processed
            const LeaveEncashment = require('../models/LeaveEncashment');
            await LeaveEncashment.updateMany(
                { employee: payroll.employee, status: 'Approved' },
                { $set: { status: 'Processed' } }
            );
            console.log(`Marked leave encashments as processed for employee ${payroll.employee}`);
        }

        res.status(200).json({ success: true, data: payroll });
    } catch (error) {
        next(error);
    }
};
