const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getAppraisals,
    createAppraisal,
    getAppraisal,
    updateAppraisal
} = require('../controllers/appraisalController');

router.use(protect);

router.route('/')
    .get(getAppraisals)
    .post(authorize('admin', 'hr', 'manager'), createAppraisal);

router.route('/:id')
    .get(getAppraisal)
    .put(updateAppraisal);

module.exports = router;
