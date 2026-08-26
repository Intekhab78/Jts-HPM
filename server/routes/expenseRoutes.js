const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
    getExpenses,
    createExpense,
    uploadReceipt,
    updateExpenseStatus,
    createSettlement,
    getSettlements,
    uploadSettlementReceipt,
    updateSettlementStatus,
    updateSettlementDraft
} = require('../controllers/travelExpenseController');

router.use(protect);

router.route('/')
    .get(getExpenses)
    .post(createExpense);

router.post('/:id/receipt', upload.single('receipt'), uploadReceipt);
router.put('/:id/status', authorize('hr', 'admin', 'finance', 'manager'), updateExpenseStatus);

// -- Settlement Routes --
router.route('/settlements')
    .get(getSettlements)
    .post(createSettlement);

router.put('/settlements/:id', updateSettlementDraft);

router.post('/settlements/:id/receipt/:expenseIndex', upload.single('receipt'), uploadSettlementReceipt);
router.put('/settlements/:id/status', authorize('hr', 'admin', 'finance', 'manager', 'director'), updateSettlementStatus);

module.exports = router;
