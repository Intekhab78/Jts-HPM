const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload'); // can reuse or create specific one for leaves
const { protect, authorize } = require('../middleware/auth');
const {
    getAllLeaves,
    getEmployeeLeaves,
    getLeaveBalances,
    applyForLeave,
    updateLeave,
    uploadAttachment,
    deleteLeave
} = require('../controllers/leaveController');

router.use(protect);

router.route('/')
    .get(authorize('hr', 'admin', 'manager', 'director', 'employee'), getAllLeaves)
    .post(applyForLeave);

router.get('/employee/:employeeId', getEmployeeLeaves);
router.get('/balance/:employeeId', getLeaveBalances);

router.route('/:id')
    .put(updateLeave)
    .delete(deleteLeave);

// Use existing multer config but potentially map to a different folder
router.post('/:id/attachment', upload.fields([{ name: 'attachment', maxCount: 1 }]), uploadAttachment);

module.exports = router;
