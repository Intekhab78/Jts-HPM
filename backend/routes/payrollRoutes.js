const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getPayrolls,
    generatePayroll,
    getGratuity,
    downloadSIF,
    downloadPayslip,
    updatePayrollStatus,
    freezePayroll,
    unfreezePayroll,
    getFrozenMonths
} = require('../controllers/payrollController');

router.use(protect);

router.get('/', authorize('hr', 'admin', 'manager', 'finance'), getPayrolls);
router.post('/generate', authorize('hr', 'admin'), generatePayroll);

// SIF and Payslip files
router.post('/sif', authorize('hr', 'admin', 'finance'), downloadSIF);

// Gratuity
router.get('/gratuity/:employeeId', getGratuity);

// Freeze / Unfreeze payroll period (must be before /:id routes)
router.put('/freeze', authorize('hr', 'admin'), freezePayroll);
router.put('/unfreeze', authorize('hr', 'admin'), unfreezePayroll);
router.get('/frozen-months', authorize('hr', 'admin', 'finance'), getFrozenMonths);

// Parameterized :id routes
router.get('/:id/payslip', downloadPayslip);
router.put('/:id/status', authorize('hr', 'admin', 'finance'), updatePayrollStatus);

module.exports = router;
