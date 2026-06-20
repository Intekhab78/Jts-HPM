const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
    downloadAttendanceReport,
    downloadPayrollReport,
    downloadEmployeeReport,
    downloadAppraisalReport,
    downloadTravelReport,
    downloadLeaveReport,
    downloadPayrollRegister
} = require('../controllers/reportController');

router.use(protect);

router.get('/attendance', authorize('admin', 'hr', 'manager', 'director'), downloadAttendanceReport);
router.get('/payroll', authorize('admin', 'hr', 'finance', 'director'), downloadPayrollReport);
router.get('/payroll-register', authorize('admin', 'hr', 'finance', 'director'), downloadPayrollRegister);
router.get('/employees', authorize('admin', 'hr', 'director'), downloadEmployeeReport);
router.get('/appraisals', authorize('admin', 'hr', 'director'), downloadAppraisalReport);
router.get('/travels', authorize('admin', 'hr', 'finance', 'director'), downloadTravelReport);
router.get('/leaves', authorize('admin', 'hr', 'manager', 'director'), downloadLeaveReport);

module.exports = router;
