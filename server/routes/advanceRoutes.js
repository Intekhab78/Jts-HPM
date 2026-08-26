const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getAdvances,
    createAdvance,
    updateAdvanceStatus
} = require('../controllers/advanceController');

router.use(protect);

router.route('/')
    .get(getAdvances)
    .post(createAdvance);

router.put('/:id/status', authorize('hr', 'admin', 'finance', 'director'), updateAdvanceStatus);

module.exports = router;
