const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
    getTravels,
    createTravel,
    updateTravelStatus,
    deleteTravel,
    uploadAdvanceDocument,
    getExpenses,
    createExpense,
    uploadReceipt,
    updateExpenseStatus
} = require('../controllers/travelExpenseController');

router.use(protect);

// -- Travel Routes --
router.route('/')
    .get(getTravels)
    .post(createTravel);
router.put('/:id/status', authorize('hr', 'admin', 'manager', 'director', 'finance'), updateTravelStatus);
router.delete('/:id', deleteTravel);
router.post('/:id/document', upload.single('advanceDocument'), uploadAdvanceDocument);

// -- Expense Routes --
// Assuming app.use('/api/travels', travelRoutes) and app.use('/api/expenses', expenseRoutes) might share the same router logic, 
// let's separate them properly.

module.exports = router;
