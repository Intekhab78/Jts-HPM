const express = require('express');
const router = express.Router();
const { getHolidays, createHoliday, updateHoliday, deleteHoliday } = require('../controllers/holidayController');
const { protect, authorize } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

router.use(protect);

router.route('/')
    .get(getHolidays)
    .post(requirePermission('attendance', 'modify'), createHoliday);

router.route('/:id')
    .put(requirePermission('attendance', 'modify'), updateHoliday)
    .delete(requirePermission('attendance', 'delete'), deleteHoliday);

module.exports = router;
