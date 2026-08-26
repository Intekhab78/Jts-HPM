const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getPayrolls,
    generatePayroll,
    getGratuity,
    downloadSIF,
    downloadPayslip,
    updatePayrollStatus
} = require('../controllers/payrollController');

router.use(protect);

router.get('/', authorize('hr', 'admin', 'manager', 'finance'), getPayrolls);
router.post('/generate', authorize('hr', 'admin', 'finance'), generatePayroll);

// SIF and Payslip files
router.post('/sif', authorize('hr', 'admin', 'finance'), downloadSIF);
router.get('/:id/payslip', downloadPayslip);

// Gratuity
router.get('/gratuity/:employeeId', getGratuity);

// Update status
router.put('/:id/status', authorize('hr', 'admin', 'finance'), updatePayrollStatus);

module.exports = router;
