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
        const employeeId = req.user.employeeRef || req.body.employee;
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Employee reference is required' });
        }

        const Employee = require('../models/Employee');
        const Company = require('../models/Company');

        const employee = await Employee.findById(employeeId).populate('company');
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const company = employee.company;
        if (company && company.advanceRules) {
            const rules = company.advanceRules;

            // 1. Check if advances are allowed
            if (rules.allowAdvances === false) {
                return res.status(400).json({
                    success: false,
                    message: `Salary advances/loans are currently disabled for company: ${company.name}`
                });
            }

            // 2. Check probation restriction
            if (rules.restrictInProbation) {
                const isProbation = employee.isProbationActive || 
                    (employee.probationEndDate && new Date(employee.probationEndDate) > new Date());
                if (isProbation) {
                    return res.status(400).json({
                        success: false,
                        message: 'Salary advances/loans cannot be issued during the probation period'
                    });
                }
            }

            // 3. Check maximum amount multiple (of basic salary)
            const effectiveBasic = (employee.basicSalary && employee.basicSalary > 0) ? employee.basicSalary : 5000;
            const maxAllowedAmount = effectiveBasic * (rules.maxAmountMultiple || 3);
            if (req.body.amount > maxAllowedAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Requested loan amount (AED ${req.body.amount}) exceeds the maximum allowed limit of ${rules.maxAmountMultiple || 3}x your basic salary (AED ${maxAllowedAmount})`
                });
            }

            // 4. Check maximum service period requests count
            const previousLoansCount = await Advance.countDocuments({
                employee: employee._id,
                status: { $ne: 'Rejected' }
            });
            if (previousLoansCount >= (rules.maxServicePeriodRequests || 5)) {
                return res.status(400).json({
                    success: false,
                    message: `You have reached the maximum allowed limit of ${rules.maxServicePeriodRequests} loans during your service period`
                });
            }

            // 5. Check minimum gap spacing
            if (previousLoansCount > 0) {
                const lastLoan = await Advance.findOne({
                    employee: employee._id,
                    status: { $ne: 'Rejected' }
                }).sort({ createdAt: -1 });

                if (lastLoan) {
                    const lastDate = new Date(lastLoan.createdAt);
                    const currentDate = new Date();
                    const diffMonths = (currentDate.getFullYear() - lastDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - lastDate.getMonth());
                    
                    if (diffMonths < (rules.minGapMonths || 6)) {
                        return res.status(400).json({
                            success: false,
                            message: `A minimum gap of ${rules.minGapMonths} months is required between successive loan requests (Your last request was ${diffMonths} month(s) ago)`
                        });
                    }
                }
            }
        }

        // Body needs: amount, reason, emiMonths
        const emiAmount = parseFloat((req.body.amount / req.body.emiMonths).toFixed(2));

        const advanceData = {
            ...req.body,
            employee: employeeId,
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

// @desc    Toggle Hold / Resume Advance installment deduction
// @route   PUT /api/advance/:id/hold
// @access  Private (Admin/HR/Finance)
exports.toggleHoldAdvance = async (req, res, next) => {
    try {
        const advance = await Advance.findById(req.params.id);
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Loan/Advance record not found' });
        }

        advance.isHeld = !advance.isHeld;
        await advance.save();

        res.status(200).json({
            success: true,
            message: `Installment deduction for this loan is now ${advance.isHeld ? 'Paused (Held)' : 'Active (Resumed)'}`,
            data: advance
        });
    } catch (error) {
        next(error);
    }
};
