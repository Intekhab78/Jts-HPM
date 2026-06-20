const Company = require('../models/Company');
const Location = require('../models/Location');

// --- COMPANY CONTROLLERS ---

// @desc    Get all companies
// @route   GET /api/masters/companies
// @access  Private
exports.getCompanies = async (req, res, next) => {
    try {
        const companies = await Company.find().sort({ name: 1 });
        res.status(200).json({ success: true, count: companies.length, data: companies });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a company
// @route   POST /api/masters/companies
// @access  Private (Admin, HR)
exports.createCompany = async (req, res, next) => {
    try {
        const company = await Company.create(req.body);
        res.status(201).json({ success: true, data: company });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Company name already exists' });
        }
        next(error);
    }
};

// @desc    Update a company
// @route   PUT /api/masters/companies/:id
// @access  Private (Admin, HR)
exports.updateCompany = async (req, res, next) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }
        res.status(200).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a company
// @route   DELETE /api/masters/companies/:id
// @access  Private (Admin)
exports.deleteCompany = async (req, res, next) => {
    try {
        const company = await Company.findByIdAndDelete(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// --- LOCATION CONTROLLERS ---

// @desc    Get all locations
// @route   GET /api/masters/locations
// @access  Private
exports.getLocations = async (req, res, next) => {
    try {
        const locations = await Location.find().populate('company', 'name').sort({ name: 1 });
        res.status(200).json({ success: true, count: locations.length, data: locations });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a location
// @route   POST /api/masters/locations
// @access  Private (Admin, HR)
exports.createLocation = async (req, res, next) => {
    try {
        const location = await Location.create(req.body);
        res.status(201).json({ success: true, data: location });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Location name already exists' });
        }
        next(error);
    }
};

// @desc    Update a location
// @route   PUT /api/masters/locations/:id
// @access  Private (Admin, HR)
exports.updateLocation = async (req, res, next) => {
    try {
        const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }
        res.status(200).json({ success: true, data: location });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a location
// @route   DELETE /api/masters/locations/:id
// @access  Private (Admin)
exports.deleteLocation = async (req, res, next) => {
    try {
        const location = await Location.findByIdAndDelete(req.params.id);
        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
