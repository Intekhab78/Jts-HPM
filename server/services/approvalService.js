const ApprovalFlow = require('../models/ApprovalFlow');

class ApprovalService {
    /**
     * Create a new approval flow
     * @param {string} module - leave, expense, advance, payroll, appraisal, onboarding, bank_update
     * @param {ObjectId} documentRef - The document._id being approved
     * @param {ObjectId} requestedBy - The user._id requesting approval
     * @param {Array} levels - [{ role: 'manager' }, { role: 'hr' }, { role: 'finance' }]
     */
    static async initiate(module, documentRef, requestedBy, levels) {
        const formattedLevels = levels.map((l, index) => ({
            level: index,
            role: l.role,
            status: index === 0 ? 'pending' : 'pending',
        }));

        const flow = await ApprovalFlow.create({
            module,
            documentRef,
            requestedBy,
            levels: formattedLevels,
            currentLevel: 0,
            overallStatus: 'in_progress',
        });

        return flow;
    }

    /**
     * Process an approval action
     * @param {ObjectId} flowId - ApprovalFlow._id
     * @param {string} action - 'approved' or 'rejected'
     * @param {ObjectId} userId - approver's user._id
     * @param {string} comments - optional comments
     */
    static async process(flowId, action, userId, comments = '') {
        const flow = await ApprovalFlow.findById(flowId);

        if (!flow) throw new Error('Approval flow not found');
        if (flow.overallStatus === 'approved' || flow.overallStatus === 'rejected') {
            throw new Error('This approval flow is already completed');
        }

        const currentLevelData = flow.levels[flow.currentLevel];
        if (!currentLevelData) throw new Error('Invalid approval level');

        // Update current level
        currentLevelData.status = action;
        currentLevelData.approvedBy = userId;
        currentLevelData.comments = comments;
        currentLevelData.actionDate = new Date();

        if (action === 'rejected') {
            flow.overallStatus = 'rejected';
        } else if (action === 'approved') {
            // Check if this is the last level
            if (flow.currentLevel >= flow.levels.length - 1) {
                flow.overallStatus = 'approved';
            } else {
                flow.currentLevel += 1;
            }
        }

        await flow.save();
        return flow;
    }

    /**
     * Get approval status for a document
     */
    static async getStatus(module, documentRef) {
        const flow = await ApprovalFlow.findOne({ module, documentRef })
            .populate('requestedBy', 'name email')
            .populate('levels.approvedBy', 'name email');
        return flow;
    }

    /**
     * Get pending approvals tailored for a specific User
     */
    static async getPendingForUser(user, module = null) {
        const query = { overallStatus: 'in_progress' };
        if (module) query.module = module;

        const roleName = user.role?.name || '';
        const employeeIdStr = user.employeeRef ? user.employeeRef.toString() : null;

        const flows = await ApprovalFlow.find(query)
            .populate({
                path: 'requestedBy',
                select: 'name email employeeRef',
                populate: { path: 'employeeRef' }
            })
            .populate('levels.approvedBy', 'name email')
            .sort({ createdAt: -1 });

        return flows.filter(f => {
            const currentLevelData = f.levels[f.currentLevel];
            if (!currentLevelData || currentLevelData.status !== 'pending') return false;

            // Admin override: Admin can see and process any pending flow
            if (roleName === 'admin') return true;

            // Simple role match for HR, Finance
            if (currentLevelData.role === 'hr' && roleName === 'hr') return true;
            if (currentLevelData.role === 'finance' && roleName === 'finance') return true;
            if (currentLevelData.role === 'director' && roleName === 'director') return true;

            // If the pending level requires a 'manager'
            if (currentLevelData.role === 'manager') {
                const requesterEmployee = f.requestedBy?.employeeRef;
                // Only show to the specific manager assigned to the requesting employee
                if (requesterEmployee && requesterEmployee.manager) {
                    return requesterEmployee.manager.toString() === employeeIdStr;
                }
            }

            return false;
        });
    }
}

module.exports = ApprovalService;
