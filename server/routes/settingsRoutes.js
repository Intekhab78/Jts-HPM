const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getOverrides,
    createOverride,
    updateOverride,
    deleteOverride
} = require('../controllers/settingsController');

router.use(protect);
router.use(authorize('admin', 'hr'));

router.route('/overrides')
    .get(getOverrides)
    .post(createOverride);

router.route('/overrides/:id')
    .put(updateOverride)
    .delete(deleteOverride);

module.exports = router;
