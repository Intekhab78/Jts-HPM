const TravelRequest = require('../models/TravelRequest');
const Expense = require('../models/Expense');

// -- TRAVEL REQUESTS -- //

// @desc    Get all travel requests
// @route   GET /api/travel
// @access  Private
exports.getTravels = async (req, res, next) => {
    try {
        let query = {};
        const userRole = req.user.role?.name || req.user.role;
        const employeeRefId = req.user.employeeRef;

        if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'finance') {
            const Employee = require('../models/Employee');
            const subordinates = await Employee.find({ manager: employeeRefId }).select('_id');
            if (subordinates.length > 0 || userRole === 'manager') {
                const subIds = subordinates.map(s => s._id);
                query.employee = { $in: [employeeRefId, ...subIds] };
            } else {
                query.employee = employeeRefId;
            }
        }

        const travels = await TravelRequest.find(query)
            .populate('employee', 'firstName lastName employeeId department manager')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: travels.length, data: travels });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new travel request
// @route   POST /api/travel
// @access  Private
exports.createTravel = async (req, res, next) => {
    try {
        const empId = req.user.employeeRef || req.body.employee;
        req.body.employee = empId;

        // Auto-approve logic if employee has no manager
        const Employee = require('../models/Employee');
        const emp = await Employee.findById(empId);

        let shouldAutoApprove = false;
        if (emp) {
            if (!emp.manager) {
                // No direct manager assigned
                shouldAutoApprove = true;
            } else {
                // If the config allows managers to self-approve, check if they are the top manager
                // (e.g., they manage people but no one manages them)
                // For now, if no manager exists above them, auto-approve.
            }
        }

        if (shouldAutoApprove) {
            req.body.status = 'Pending Finance';
        }

        // Initialize advance values
        if (req.body.requestedAdvance) {
            req.body.requestedAdvance = Number(req.body.requestedAdvance);
        }

        const travel = await TravelRequest.create(req.body);
        res.status(201).json({ success: true, data: travel, autoApproved: shouldAutoApprove });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Travel Status
// @route   PUT /api/travel/:id/status
// @access  Private (Admin/Manager)
exports.updateTravelStatus = async (req, res, next) => {
    try {
        const { status, approvedAdvance } = req.body;
        const updateData = { status };

        if (approvedAdvance !== undefined) {
            updateData.approvedAdvance = Number(approvedAdvance);
        }

        const travel = await TravelRequest.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        if (!travel) return res.status(404).json({ success: false, message: 'Not found' });

        res.status(200).json({ success: true, data: travel });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete own travel request (employee only, non-approved)
// @route   DELETE /api/travels/:id
// @access  Private (own request only)
exports.deleteTravel = async (req, res, next) => {
    try {
        const travel = await TravelRequest.findById(req.params.id);
        if (!travel) {
            return res.status(404).json({ success: false, message: 'Travel request not found' });
        }

        // Only the owner can delete
        const employeeRefId = req.user.employeeRef?.toString() || req.user.employeeRef;
        if (travel.employee.toString() !== employeeRefId) {
            return res.status(403).json({ success: false, message: 'You can only delete your own travel requests' });
        }

        // Cannot delete approved travel plans
        if (travel.status === 'Approved') {
            return res.status(403).json({ success: false, message: 'Approved travel plans cannot be deleted' });
        }

        await TravelRequest.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Travel request deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload Advance Document (Quotation, Itinerary, etc.)
// @route   POST /api/travel/:id/document
// @access  Private
exports.uploadAdvanceDocument = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

        const travel = await TravelRequest.findById(req.params.id);
        if (!travel) return res.status(404).json({ success: false, message: 'Not found' });

        // Using standard upload middleware currently points to /uploads/employees
        travel.advanceDocumentUrl = `/uploads/employees/${req.file.filename}`;
        await travel.save();

        res.status(200).json({ success: true, data: travel, message: 'Advance document uploaded successfully' });
    } catch (error) {
        next(error);
    }
};


// -- EXPENSES -- //

// @desc    Get all expenses
// @route   GET /api/expense
// @access  Private
exports.getExpenses = async (req, res, next) => {
    try {
        let query = {};
        const userRole = req.user.role?.name || req.user.role;
        const employeeRefId = req.user.employeeRef;

        if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'finance') {
            const Employee = require('../models/Employee');
            const subordinates = await Employee.find({ manager: employeeRefId }).select('_id');
            if (subordinates.length > 0 || userRole === 'manager') {
                const subIds = subordinates.map(s => s._id);
                query.employee = { $in: [employeeRefId, ...subIds] };
            } else {
                query.employee = employeeRefId;
            }
        }

        const expenses = await Expense.find(query)
            .populate('employee', 'firstName lastName employeeId department manager')
            .populate('travelRequest', 'purpose destination') // Optional link to a trip
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: expenses.length, data: expenses });
    } catch (error) {
        next(error);
    }
};

// @desc    Create expense claim
// @route   POST /api/expense
// @access  Private
exports.createExpense = async (req, res, next) => {
    try {
        const empId = req.user.employeeRef || req.body.employee;
        req.body.employee = empId;

        // Auto-approve logic if employee has no manager
        const Employee = require('../models/Employee');
        const emp = await Employee.findById(empId);

        let shouldAutoApprove = false;
        if (emp) {
            if (!emp.manager) {
                // No direct manager assigned
                shouldAutoApprove = true;
            }
        }

        if (shouldAutoApprove) {
            req.body.status = 'Pending Finance';
        }

        const expense = await Expense.create(req.body);
        res.status(201).json({ success: true, data: expense, autoApproved: shouldAutoApprove });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload Receipt Image/PDF
// @route   POST /api/expense/:id/receipt
// @access  Private
exports.uploadReceipt = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json({ success: false, message: 'Not found' });

        expense.receiptUrl = `/uploads/expenses/${req.file.filename}`;
        await expense.save();

        res.status(200).json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Expense Status
// @route   PUT /api/expense/:id/status
// @access  Private (Admin/Finance)
exports.updateExpenseStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const update = { status };
        if (status === 'Reimbursed') {
            update.reimbursedDate = Date.now();
        }

        const expense = await Expense.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!expense) return res.status(404).json({ success: false, message: 'Not found' });

        res.status(200).json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// ADVANCE SETTLEMENT CONTROLLERS
// ==========================================

const AdvanceSettlement = require('../models/AdvanceSettlement');

// @desc    Create a new Advance Settlement
// @route   POST /api/expenses/settlements
// @access  Private
exports.createSettlement = async (req, res, next) => {
    try {
        const empId = req.user.employeeRef || req.body.employee;
        const { travelRequest, expenses, additionalAmountRequested, status: reqStatus } = req.body;

        const TravelRequest = require('../models/TravelRequest');
        const travel = await TravelRequest.findById(travelRequest);
        if (!travel) return res.status(404).json({ success: false, message: 'Travel Request not found' });

        // Calculate totals
        let totalExpenseAmount = 0;
        if (expenses && expenses.length > 0) {
            expenses.forEach(exp => {
                totalExpenseAmount += Number(exp.amount) || 0;
            });
        }

        // Positive balance means employee owes company, negative means company owes employee
        const balance = (travel.approvedAdvance || 0) - totalExpenseAmount;

        const Employee = require('../models/Employee');
        const emp = await Employee.findById(empId);

        let status = reqStatus || 'Draft';
        if (status !== 'Draft') {
            status = 'Pending Manager';
            if (emp && !emp.manager) {
                status = 'Pending Finance'; // Auto-escalate if no manager
            }
        }

        const settlement = await AdvanceSettlement.create({
            employee: empId,
            travelRequest,
            expenses: expenses || [],
            totalAmount: totalExpenseAmount,
            additionalAmountRequested: additionalAmountRequested || 0,
            balance,
            status
        });

        // Mark travel request as completed/settled only if submitted
        if (status !== 'Draft') {
            travel.status = 'Completed';
            await travel.save();
        }

        res.status(201).json({ success: true, data: settlement });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a Draft Settlement
// @route   PUT /api/expenses/settlements/:id
// @access  Private 
exports.updateSettlementDraft = async (req, res, next) => {
    try {
        const settlement = await AdvanceSettlement.findById(req.params.id);
        if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' });

        // Only Drafts can be freely edited by the employee in this way
        if (settlement.status !== 'Draft') {
            return res.status(400).json({ success: false, message: 'Only Draft settlements can be updated' });
        }

        const { expenses, additionalAmountRequested, status: reqStatus } = req.body;

        let totalExpenseAmount = 0;
        if (expenses && expenses.length > 0) {
            // Preserve existing receipt URLs when replacing expenses array
            const mergedExpenses = expenses.map(newExp => {
                const existing = settlement.expenses.find(e => e._id && e._id.toString() === newExp._id);
                totalExpenseAmount += Number(newExp.amount) || 0;
                return {
                    ...newExp,
                    receiptUrl: existing ? existing.receiptUrl : newExp.receiptUrl
                };
            });
            settlement.expenses = mergedExpenses;
        }

        settlement.totalAmount = totalExpenseAmount;
        settlement.additionalAmountRequested = additionalAmountRequested || 0;

        const TravelRequest = require('../models/TravelRequest');
        const travel = await TravelRequest.findById(settlement.travelRequest);
        settlement.balance = (travel?.approvedAdvance || 0) - totalExpenseAmount;

        if (reqStatus && reqStatus !== 'Draft') {
            // Employee wants to Complete & Submit
            const Employee = require('../models/Employee');
            const emp = await Employee.findById(settlement.employee);

            let newStatus = 'Pending Manager';
            if (emp && !emp.manager) {
                newStatus = 'Pending Finance';
            }
            settlement.status = newStatus;

            // Mark parent travel request as completed
            if (travel) {
                travel.status = 'Completed';
                await travel.save();
            }
        }

        await settlement.save();
        res.status(200).json({ success: true, data: settlement });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all settlements for employee/manager/finance
// @route   GET /api/expenses/settlements
// @access  Private
exports.getSettlements = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role === 'employee') {
            query.employee = req.user.employeeRef;
        } else if (req.user.role === 'manager') {
            const Employee = require('../models/Employee');
            const managedEmployees = await Employee.find({ manager: req.user.employeeRef }).select('_id');
            const managedIds = managedEmployees.map(e => e._id);
            // Manager sees their own AND their subordinates
            query.$or = [{ employee: { $in: managedIds } }, { employee: req.user.employeeRef }];
        }
        // Admin, HR, Finance see all

        const settlements = await AdvanceSettlement.find(query)
            .populate('employee', 'firstName lastName employeeId department manager')
            .populate('travelRequest', 'purpose destination approvedAdvance fromDate toDate estimatedBudget')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: settlements.length, data: settlements });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload Receipt for a specific expense line in a settlement
// @route   POST /api/expenses/settlements/:id/receipt/:expenseIndex
// @access  Private
exports.uploadSettlementReceipt = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

        const settlement = await AdvanceSettlement.findById(req.params.id);
        if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' });

        const expenseIndex = parseInt(req.params.expenseIndex, 10);
        if (isNaN(expenseIndex) || expenseIndex < 0 || expenseIndex >= settlement.expenses.length) {
            return res.status(400).json({ success: false, message: 'Invalid expense index' });
        }

        settlement.expenses[expenseIndex].receiptUrl = `/uploads/expenses/${req.file.filename}`;
        await settlement.save();

        res.status(200).json({ success: true, data: settlement });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Settlement Status
// @route   PUT /api/expenses/settlements/:id/status
// @access  Private (Manager/Finance)
exports.updateSettlementStatus = async (req, res, next) => {
    try {
        const { status, deductFromSalary, lineItems } = req.body;
        const settlement = await AdvanceSettlement.findById(req.params.id).populate('travelRequest');

        if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' });

        // Update line items if provided
        if (lineItems && Array.isArray(lineItems)) {
            let newlyApprovedTotal = 0;
            lineItems.forEach(updatedLine => {
                const expenseLine = settlement.expenses.id(updatedLine._id);
                if (expenseLine) {
                    if (updatedLine.status) expenseLine.status = updatedLine.status;
                    if (updatedLine.comments !== undefined) expenseLine.comments = updatedLine.comments;

                    if (expenseLine.status === 'Approved') {
                        newlyApprovedTotal += Number(expenseLine.amount) || 0;
                    }
                }
            });
            // Recalculate totals based ONLY on approved lines
            settlement.totalAmount = newlyApprovedTotal;
            settlement.balance = (settlement.travelRequest?.approvedAdvance || 0) - newlyApprovedTotal;
        }

        settlement.status = status;

        if (status === 'Pending Finance') {
            settlement.managerApprovalDate = Date.now();
        } else if (status === 'Approved') {
            settlement.financeApprovalDate = Date.now();
            if (deductFromSalary !== undefined) {
                // Allows Finance to flag positive balances for Payroll to deduct
                settlement.deductFromSalary = deductFromSalary === true || deductFromSalary === 'true';
            }
        }

        await settlement.save();

        res.status(200).json({ success: true, data: settlement });
    } catch (error) {
        next(error);
    }
};
