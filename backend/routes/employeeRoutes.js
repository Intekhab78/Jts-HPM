const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    generateEmployeeId,
    uploadDocuments,
    confirmEmployeeProbation
} = require('../controllers/employeeController');

// All routes require authentication
router.use(protect);

router.get('/generate-id', authorize('hr', 'admin'), generateEmployeeId);

router.route('/')
    .get(authorize('hr', 'admin', 'manager', 'director'), getEmployees)
    .post(authorize('hr', 'admin'), createEmployee);

router.route('/:id')
    .get(getEmployeeById) // Depending on the business rule, an employee can see their own
    .put(authorize('hr', 'admin'), updateEmployee)
    .delete(authorize('admin'), deleteEmployee);

router.put('/:id/confirm-probation', authorize('hr', 'admin'), confirmEmployeeProbation);

// Upload endpoint using Multer fields
router.post('/:id/documents', authorize('hr', 'admin'), upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'passport', maxCount: 1 },
    { name: 'visa', maxCount: 1 },
    { name: 'emiratesIdDoc', maxCount: 1 },
    { name: 'contract', maxCount: 1 },
    { name: 'others', maxCount: 10 }
]), uploadDocuments);

module.exports = router;
