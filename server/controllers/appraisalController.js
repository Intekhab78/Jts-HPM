const Appraisal = require('../models/Appraisal');

// Calculate overall rating based on weights
const calculateRating = (kpis, scoreField) => {
    let totalScore = 0;
    let totalWeight = 0;
    // For calculating based on whichever score is provided (manager > self)
    kpis.forEach(kpi => {
        const score = kpi[scoreField] || 0;
        totalScore += (score * kpi.weight);
        totalWeight += kpi.weight;
    });

    // Normalize to a 0-5 scale
    if (totalWeight === 0) return 0;
    return parseFloat((totalScore / totalWeight).toFixed(2));
};

// @desc    Get appraisals
// @route   GET /api/appraisals
// @access  Private
exports.getAppraisals = async (req, res, next) => {
    try {
        let query = {};

        // Employees only see their own
        const userRole = req.user.role?.name || req.user.role;
        if (userRole === 'employee') {
            query.employee = req.user.employeeRef;
        }
        // Managers might only see ones they manage (in a fuller system we'd assign managers properly, 
        // for this scope we'll assume HR/Admin sees all, Managers see all or assigned)

        const appraisals = await Appraisal.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .populate('manager', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: appraisals.length, data: appraisals });
    } catch (error) {
        next(error);
    }
};

// @desc    Create Appraisal (HR / Admin initiates)
// @route   POST /api/appraisals
// @access  Private (Admin/HR)
exports.createAppraisal = async (req, res, next) => {
    try {
        const appraisal = await Appraisal.create(req.body);
        res.status(201).json({ success: true, data: appraisal });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single appraisal
// @route   GET /api/appraisals/:id
// @access  Private
exports.getAppraisal = async (req, res, next) => {
    try {
        const appraisal = await Appraisal.findById(req.params.id)
            .populate('employee', 'firstName lastName employeeId department designation')
            .populate('manager', 'name');

        if (!appraisal) return res.status(404).json({ success: false, message: 'Not found' });

        // Basic ACL check could go here if employee tries to read someone else's
        res.status(200).json({ success: true, data: appraisal });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Appraisal (Used for Self Assessment, Manager Review, etc)
// @route   PUT /api/appraisals/:id
// @access  Private
exports.updateAppraisal = async (req, res, next) => {
    try {
        let appraisal = await Appraisal.findById(req.params.id);
        if (!appraisal) return res.status(404).json({ success: false, message: 'Not found' });

        const { kpis, selfComments, managerComments, status, incrementRecommendation } = req.body;

        if (kpis) appraisal.kpis = kpis;
        if (selfComments !== undefined) appraisal.selfComments = selfComments;
        if (managerComments !== undefined) appraisal.managerComments = managerComments;
        if (status) appraisal.status = status;
        if (incrementRecommendation) appraisal.incrementRecommendation = incrementRecommendation;

        // Auto-calculate rating based on the current state
        if (appraisal.status === 'Self-Assessment') {
            appraisal.overallRating = calculateRating(appraisal.kpis, 'selfScore');
        } else if (appraisal.status === 'Manager Review' || appraisal.status === 'Finalized') {
            appraisal.overallRating = calculateRating(appraisal.kpis, 'managerScore');
        }

        await appraisal.save();

        res.status(200).json({ success: true, data: appraisal });
    } catch (error) {
        next(error);
    }
};
