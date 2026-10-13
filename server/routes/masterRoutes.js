const express = require('express');
const router = express.Router();
const {
    getCompanies, createCompany, updateCompany, deleteCompany, uploadCompanyLogo,
    getLocations, createLocation, updateLocation, deleteLocation
} = require('../controllers/masterController');
const { protect } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const upload = require('../middleware/upload');

router.use(protect);

// Company Routes
router.route('/companies')
    .get(getCompanies)
    .post(requirePermission('employees', 'modify'), createCompany);

router.post('/companies/:id/logo', upload.single('logo'), requirePermission('employees', 'modify'), uploadCompanyLogo);

router.route('/companies/:id')
    .put(requirePermission('employees', 'modify'), updateCompany)
    .delete(requirePermission('employees', 'delete'), deleteCompany);

// Location Routes
router.route('/locations')
    .get(getLocations)
    .post(requirePermission('employees', 'modify'), createLocation);

router.route('/locations/:id')
    .put(requirePermission('employees', 'modify'), updateLocation)
    .delete(requirePermission('employees', 'delete'), deleteLocation);

module.exports = router;
