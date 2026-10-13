const express = require('express');
const router = express.Router();
const ApprovalService = require('../services/approvalService');
const { protect, authorize } = require('../middleware/auth');

// Get pending approvals for current user
router.get('/pending', protect, async (req, res, next) => {
    try {
        const { module } = req.query;
        const flows = await ApprovalService.getPendingForUser(req.user, module);
        res.status(200).json({ success: true, count: flows.length, data: flows });
    } catch (error) {
        next(error);
    }
});

// Get approval status for a specific document
router.get('/status/:module/:documentId', protect, async (req, res, next) => {
    try {
        const flow = await ApprovalService.getStatus(req.params.module, req.params.documentId);
        if (!flow) {
            return res.status(404).json({ success: false, message: 'Approval flow not found' });
        }
        res.status(200).json({ success: true, data: flow });
    } catch (error) {
        next(error);
    }
});

// Process an approval (approve/reject)
router.post('/process/:flowId', protect, async (req, res, next) => {
    try {
        const { action, comments } = req.body;
        if (!['approved', 'rejected'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Action must be "approved" or "rejected"' });
        }

        const flow = await ApprovalService.process(req.params.flowId, action, req.user._id, comments);
        res.status(200).json({ success: true, data: flow });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
