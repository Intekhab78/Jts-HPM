const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getAdvances,
    createAdvance,
    updateAdvanceStatus,
    toggleHoldAdvance
} = require('../controllers/advanceController');

router.use(protect);

router.route('/')
    .get(getAdvances)
    .post(createAdvance);

router.put('/:id/status', authorize('hr', 'admin', 'finance', 'director'), updateAdvanceStatus);
router.put('/:id/hold', authorize('hr', 'admin', 'finance', 'director'), toggleHoldAdvance);

module.exports = router;
