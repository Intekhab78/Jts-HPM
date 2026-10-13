const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    getPayElements,
    getPayElement,
    createPayElement,
    updatePayElement,
    deletePayElement
} = require('../controllers/payElementController');

const router = express.Router();

router.route('/')
    .get(protect, getPayElements)
    .post(protect, authorize('admin', 'hr'), createPayElement);

router.route('/:id')
    .get(protect, getPayElement)
    .put(protect, authorize('admin', 'hr'), updatePayElement)
    .delete(protect, authorize('admin', 'hr'), deletePayElement);

module.exports = router;
