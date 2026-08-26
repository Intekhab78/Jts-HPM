const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload'); // can reuse or create specific one for leaves
const { protect, authorize } = require('../middleware/auth');
const {
    getAllLeaves,
    getEmployeeLeaves,
    getLeaveBalances,
    getAllEmployeeLeaveBalances,
    applyForLeave,
    updateLeave,
    uploadAttachment,
    deleteLeave,
    requestLeaveEncashment,
    getLeaveEncashments,
    updateLeaveEncashmentStatus
} = require('../controllers/leaveController');

router.use(protect);

router.post('/encash', requestLeaveEncashment);
router.get('/encashments', getLeaveEncashments);
router.put('/encashments/:id/status', authorize('hr', 'admin'), updateLeaveEncashmentStatus);

router.route('/')
    .get(authorize('hr', 'admin', 'manager', 'director', 'employee'), getAllLeaves)
    .post(applyForLeave);

router.get('/balances', authorize('hr', 'admin', 'director'), getAllEmployeeLeaveBalances);
router.get('/employee/:employeeId', getEmployeeLeaves);
router.get('/balance/:employeeId', getLeaveBalances);

router.route('/:id')
    .put(updateLeave)
    .delete(deleteLeave);

// Use existing multer config but potentially map to a different folder
router.post('/:id/attachment', upload.fields([{ name: 'attachment', maxCount: 1 }]), uploadAttachment);

module.exports = router;
