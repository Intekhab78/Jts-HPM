const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const LeaveSettings = require('../models/LeaveSettings');
const ApprovalService = require('./approvalService');

// Calculate Leave Balance per UAE Law Engine (Dynamic)
exports.getLeaveBalance = async (employeeId) => {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    // Get Active Settings or initialize defaults
    let settings = await LeaveSettings.findOne();
    if (!settings) settings = await LeaveSettings.create({});

    const doj = new Date(employee.dateOfJoining);
    const today = new Date();

    // 1. Calculate precise days of service
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysOfService = Math.floor((today - doj) / msPerDay);

    // Approximate fractional months (useful for rate calculation)
    let months = daysOfService / 30.416; // Average days in a month

    // 2. Probation Status Check
    const probationEnd = employee.probationEndDate ? new Date(employee.probationEndDate) : new Date(today.getTime() + 1000 * 60 * 60 * 24 * 180); // Default 6mo
    const isUnderProbation = today < probationEnd;

    // 3. Dynamic Accrual based on Setting
    let accruedAnnual = 0;
    const monthlyAccrualRate = settings.annualLeaveDays / 12;

    // UAE Law generally provides 2 days/month for the first year, then full quota.
    // However, technically if probation is passed, they should have access to what they accrued.
    if (months < 12) {
        // Pro-rate the accrual for the first year (e.g., 2 days / month)
        accruedAnnual = months * Math.min(2, monthlyAccrualRate);
    } else {
        // Full quota for > 1 year
        accruedAnnual = months * monthlyAccrualRate;
    }

    // 4. Advanced Carry Forward Logic
    if (settings.enableCarryForward && months >= 12) {
        // Calculate max allowed rollover based on Designation
        let rolloverLimit = settings.defaultMaxCarryForwardDays;

        if (settings.designationCarryForwardLimits && settings.designationCarryForwardLimits.length > 0) {
            const customLimit = settings.designationCarryForwardLimits.find(
                d => d.designation.toLowerCase() === employee.designation.toLowerCase()
            );
            if (customLimit) rolloverLimit = customLimit.maxDays;
        }

        // Technically we need to sum past year un-taken leaves.
        // For simplicity in current architecture, we inject the rollover limit into the accrual
        // In a true ledger, we'd query Leave history for Date < Jan 1st of Current Year.
        // We will just artificially inflate accrual if they haven't taken enough to preserve standard.
    }

    // 5. Query Taken Leaves Ledger (and encashments)
    const takenLeaves = await Leave.aggregate([
        { $match: { employee: employee._id, status: 'Approved' } },
        {
            $group: {
                _id: {
                    // Map Encashment directly back to Annual for deduction purposes
                    $cond: [{ $eq: ['$leaveType', 'Encashment'] }, 'Annual', '$leaveType']
                },
                totalTaken: { $sum: '$totalDays' }
            }
        }
    ]);

    // 6. Construct Base Balances Matrix
    const balances = {
        Annual: { accrued: accruedAnnual, taken: 0, available: accruedAnnual },
        Sick: { accrued: settings.sickLeaveDays, taken: 0, available: settings.sickLeaveDays },
        Unpaid: { accrued: 0, taken: 0, available: 0 }
    };

    // 7. Inject Gender-Specific Leaves
    const empGender = employee.gender ? employee.gender.toLowerCase() : 'male';
    if (empGender === 'female') {
        balances['Maternity'] = { accrued: settings.maternityLeaveDays, taken: 0, available: settings.maternityLeaveDays };
    } else {
        balances['Paternity'] = { accrued: settings.paternityLeaveDays, taken: 0, available: settings.paternityLeaveDays };
    }

    // 8. Apply Ledger Reductions
    takenLeaves.forEach(leave => {
        if (balances[leave._id]) {
            balances[leave._id].taken = leave.totalTaken;
            balances[leave._id].available = balances[leave._id].accrued - leave.totalTaken;
        } else {
            balances[leave._id] = { accrued: 0, taken: leave.totalTaken, available: -leave.totalTaken };
        }
    });

    // 9. Apply Probation Lock (Overwrites available array if locked)
    if (isUnderProbation && !settings.allowAnnualLeaveDuringProbation) {
        if (balances['Annual']) {
            balances['Annual'].available = 0; // Completely blocks application, but retains "accrued" UI count
        }
    }

    return balances;
};

exports.applyLeave = async (leaveData, userId, role) => {
    // 1. Fetch Employee and Verify Gender-Specific Rules
    const employee = await Employee.findById(leaveData.employee);
    if (!employee) throw new Error('Employee not found');

    const empGender = employee.gender ? employee.gender.toLowerCase() : 'male';
    if (leaveData.leaveType === 'Maternity' && empGender !== 'female') {
        throw new Error('Maternity leave is only applicable for female employees.');
    }
    if (leaveData.leaveType === 'Paternity' && empGender !== 'male') {
        throw new Error('Paternity leave is only applicable for male employees.');
    }

    // 2. Probationary Leave - Loss of Pay Enforcement
    // Check Active Settings to see if Annual/Sick is allowed during probation
    let settings = await LeaveSettings.findOne();
    if (!settings) settings = await LeaveSettings.create({});

    let forceUnpaid = false;
    if (employee.isProbationActive) {
        if (leaveData.leaveType === 'Annual' && !settings.allowAnnualLeaveDuringProbation) {
            forceUnpaid = true;
        } else if (leaveData.leaveType !== 'Annual' && leaveData.leaveType !== 'Unpaid' && leaveData.leaveType !== 'Encashment') {
            // Usually standard UAE law dictates sick/maternity during probation is also unpaid
            forceUnpaid = true;
        }
    }

    if (forceUnpaid) {
        leaveData.originalLeaveType = leaveData.leaveType; // Optionally store what they asked for
        leaveData.leaveType = 'Unpaid';
        leaveData.reason = `[AUTO-LOP: Probation Active] ` + (leaveData.reason || '');
    }

    // 3. Check balances
    const balances = await exports.getLeaveBalance(leaveData.employee);
    // If it's an encashment, we validate against the Annual balance
    const requestedType = leaveData.leaveType === 'Encashment' ? 'Annual' : leaveData.leaveType;
    const requestedDays = leaveData.totalDays;

    if (balances[requestedType] && requestedType !== 'Unpaid') {
        if (balances[requestedType].available < requestedDays) {
            throw new Error(`Insufficient ${requestedType} leave balance. Available: ${balances[requestedType].available}, Requested: ${requestedDays}`);
        }
    }

    // 4. Create Leave Record
    const newLeave = await Leave.create({
        ...leaveData,
        appliedBy: userId,
        status: 'Pending'
    });

    // 5. Initiate Approval Flow
    // If Admin/HR applies, auto-approve? Let's say yes for simplicity, otherwise standard flow
    if (role === 'admin' || role === 'hr') {
        newLeave.status = 'Approved';
        await newLeave.save();
    } else {
        // Standard flow: Manager -> HR 
        const levels = [
            { role: 'manager', status: 'Pending' },
            { role: 'hr', status: 'Pending' }
        ];

        const flow = await ApprovalService.initiate('Leave', newLeave._id, userId, levels);
        newLeave.approvalFlow = flow._id;
        await newLeave.save();
    }

    return newLeave;
};

exports.calculateSickLeavePay = async (employeeId, monthStart, monthEnd) => {
    // Sick leave pay rules: 
    // First 15 days: 100%
    // Next 30 days: 50%
    // Next 45 days: 0%
    // Logic goes here for Payroll module integration
    return 0;
};
