const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getShifts,
    createShift,
    updateShift,
    deleteShift,
    mapEmployees,
    autoAssignRoster
} = require('../controllers/shiftController');

router.use(protect);
router.use(authorize('hr', 'admin'));

router.route('/')
    .get(getShifts)
    .post(createShift);

router.post('/auto-map', autoAssignRoster);

router.route('/:id')
    .put(updateShift)
    .delete(deleteShift);

router.post('/:id/map', mapEmployees);

module.exports = router;
