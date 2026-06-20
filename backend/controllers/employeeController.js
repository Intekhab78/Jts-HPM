const Employee = require('../models/Employee');
const User = require('../models/User');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private (HR, Admin, Manager)
exports.getEmployees = async (req, res, next) => {
    try {
        let query = {};
        const userRole = req.user.role?.name || req.user.role;
        const employeeRefId = req.user.employeeRef;

        if (userRole !== 'admin' && userRole !== 'hr') {
            // Find if this user manages anyone
            const subordinates = await Employee.find({ manager: employeeRefId }).select('_id');

            if (subordinates.length > 0 || userRole === 'manager') {
                const subIds = subordinates.map(s => s._id);
                query._id = { $in: [employeeRefId, ...subIds] };
            } else {
                // Regular employee sees only themselves in dropdowns
                query._id = employeeRefId;
            }
        }

        const employees = await Employee.find(query)
            .populate('company', 'name')
            .populate('location', 'name')
            .populate('payElements.element')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: employees.length, data: employees });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private
exports.getEmployeeById = async (req, res, next) => {
    try {
        const employee = await Employee.findById(req.params.id)
            .populate('company', 'name')
            .populate('location', 'name')
            .populate('manager', 'firstName lastName employeeId')
            .populate('payElements.element');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate next Employee ID
// @route   GET /api/employees/generate-id
// @access  Private (HR, Admin)
exports.generateEmployeeId = async (req, res, next) => {
    try {
        // Find the employee with the highest employeeId
        const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });

        let newId = 'EMP-001';
        if (lastEmployee && lastEmployee.employeeId && lastEmployee.employeeId.startsWith('EMP-')) {
            const lastNumber = parseInt(lastEmployee.employeeId.split('-')[1]);
            const nextNumber = lastNumber + 1;
            newId = `EMP-${nextNumber.toString().padStart(3, '0')}`;
        }

        res.status(200).json({ success: true, data: newId });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private (HR, Admin)
exports.createEmployee = async (req, res, next) => {
    try {
        // Basic val
        const employeeData = { ...req.body };

        const employee = await Employee.create(employeeData);

        let generatedCredentials = null;

        try {
            const Role = require('../models/Role');
            const empRole = await Role.findOne({ name: 'employee' });

            if (empRole && employeeData.email) {
                const loginEmail = employeeData.email;
                const loginPassword = 'password123'; // Standard default password

                await User.create({
                    name: `${employeeData.firstName} ${employeeData.lastName}`,
                    email: loginEmail,
                    password: loginPassword,
                    role: empRole._id,
                    employeeRef: employee._id
                });

                console.log(`Auto-generated user account for ${loginEmail} with password ${loginPassword}`);
                generatedCredentials = { loginId: employee.employeeId, password: loginPassword };
            }
        } catch (autoGenError) {
            console.error('Failed to auto-generate user account', autoGenError);
        }

        res.status(201).json({
            success: true,
            data: employee,
            credentials: generatedCredentials // HR can view this to share with the new employee
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (HR, Admin)
exports.updateEmployee = async (req, res, next) => {
    try {
        let employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
exports.deleteEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        await employee.deleteOne();

        // Also remove associated user
        await User.findOneAndDelete({ employeeRef: req.params.id });

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Confirm Employee Probation
// @route   PUT /api/employees/:id/confirm-probation
// @access  Private (Admin, HR)
exports.confirmEmployeeProbation = async (req, res, next) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        employee.isProbationActive = false;
        await employee.save();

        res.status(200).json({ success: true, message: 'Employee probation confirmed successfully', data: employee });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload documents
// @route   POST /api/employees/:id/documents
// @access  Private (HR, Admin)
exports.uploadDocuments = async (req, res, next) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ success: false, message: 'Please upload files' });
        }

        const uploadedDocs = employee.documents || { others: [] };

        // Handle specific fields
        const docTypes = ['passport', 'visa', 'emiratesIdDoc', 'contract'];
        docTypes.forEach(type => {
            if (req.files[type] && req.files[type].length > 0) {
                uploadedDocs[type] = `/uploads/employees/${req.files[type][0].filename}`;
            }
        });

        if (req.files['profilePhoto'] && req.files['profilePhoto'].length > 0) {
            employee.profilePhoto = `/uploads/employees/${req.files['profilePhoto'][0].filename}`;
        }

        // Handle others
        if (req.files['others'] && req.files['others'].length > 0) {
            req.files['others'].forEach(file => {
                uploadedDocs.others.push({
                    name: file.originalname,
                    fileUrl: `/uploads/employees/${file.filename}`
                });
            });
        }

        employee.documents = uploadedDocs;
        await employee.save();

        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        next(error);
    }
};
