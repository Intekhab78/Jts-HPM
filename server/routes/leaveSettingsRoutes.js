const express = require('express');
const { getSettings, updateSettings } = require('../controllers/leaveSettingsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getSettings)
    .put(authorize('admin'), updateSettings);

module.exports = router;
