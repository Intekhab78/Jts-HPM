const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
    getAttendance,
    addAttendance,
    bulkUploadAttendance,
    deleteAttendance,
    lockAttendance,
    punchInOut,
    approveAttendance,
    requestAttendance
} = require('../controllers/attendanceController');

router.use(protect);

router.route('/')
    .get(getAttendance)
    .post(authorize('hr', 'admin', 'manager'), addAttendance);

router.post('/bulk', authorize('hr', 'admin'), upload.single('excelFile'), bulkUploadAttendance);

router.post('/punch', upload.single('photo'), punchInOut);

router.put('/:id/approve', authorize('hr', 'admin', 'manager'), approveAttendance);

router.delete('/:id', authorize('hr', 'admin'), deleteAttendance);

router.post('/request', requestAttendance);

router.post('/lock', authorize('hr', 'admin', 'finance'), lockAttendance);

module.exports = router;
