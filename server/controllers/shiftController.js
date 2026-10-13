const ShiftSchedule = require('../models/ShiftSchedule');
const Employee = require('../models/Employee');

// @desc    Get all shifts
// @route   GET /api/shifts
// @access  Private (Admin/HR)
exports.getShifts = async (req, res, next) => {
    try {
        const shifts = await ShiftSchedule.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: shifts.length, data: shifts });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new shift
// @route   POST /api/shifts
// @access  Private (Admin/HR)
exports.createShift = async (req, res, next) => {
    try {
        const shift = await ShiftSchedule.create(req.body);
        res.status(201).json({ success: true, data: shift });
    } catch (error) {
        next(error);
    }
};

// @desc    Update shift settings
// @route   PUT /api/shifts/:id
// @access  Private (Admin/HR)
exports.updateShift = async (req, res, next) => {
    try {
        const shift = await ShiftSchedule.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found' });
        }
        res.status(200).json({ success: true, data: shift });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete shift
// @route   DELETE /api/shifts/:id
// @access  Private (Admin/HR)
exports.deleteShift = async (req, res, next) => {
    try {
        const shift = await ShiftSchedule.findById(req.params.id);
        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found' });
        }
        
        // Remove shift assignment from employees
        await Employee.updateMany({ assignedShift: shift._id }, { $unset: { assignedShift: "" } });
        
        await shift.deleteOne();
        res.status(200).json({ success: true, message: 'Shift deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Manually map employees to a shift
// @route   POST /api/shifts/:id/map
// @access  Private (Admin/HR)
exports.mapEmployees = async (req, res, next) => {
    try {
        const { employeeIds } = req.body;
        const shift = await ShiftSchedule.findById(req.params.id);
        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found' });
        }

        if (!Array.isArray(employeeIds)) {
            return res.status(400).json({ success: false, message: 'employeeIds must be an array' });
        }

        // Set shift for these employees
        await Employee.updateMany(
            { _id: { $in: employeeIds } },
            { assignedShift: shift._id }
        );

        res.status(200).json({ success: true, message: `Successfully mapped ${employeeIds.length} employees to ${shift.name}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Auto-generate & auto-map shift rosters based on employee roster group
// @route   POST /api/shifts/auto-map
// @access  Private (Admin/HR)
exports.autoAssignRoster = async (req, res, next) => {
    try {
        // 1. Ensure the default shifts exist
        let officeShift = await ShiftSchedule.findOne({ name: /office/i });
        if (!officeShift) {
            officeShift = await ShiftSchedule.create({
                name: 'Office Standard Shift',
                startTime: '09:00',
                endTime: '18:00',
                lunchDuration: 30,
                lateGracePeriod: 15,
                earlyGracePeriod: 30,
                workingType: 'Standard'
            });
        }

        let retailMorning = await ShiftSchedule.findOne({ name: /retail morning/i });
        if (!retailMorning) {
            retailMorning = await ShiftSchedule.create({
                name: 'Retail Morning Shift',
                startTime: '08:00',
                endTime: '16:00',
                lunchDuration: 30,
                lateGracePeriod: 15,
                earlyGracePeriod: 30,
                workingType: 'Standard'
            });
        }

        let retailEvening = await ShiftSchedule.findOne({ name: /retail evening/i });
        if (!retailEvening) {
            retailEvening = await ShiftSchedule.create({
                name: 'Retail Evening Shift',
                startTime: '16:00',
                endTime: '00:00',
                lunchDuration: 30,
                lateGracePeriod: 15,
                earlyGracePeriod: 30,
                workingType: 'Standard'
            });
        }

        let warehouseShift = await ShiftSchedule.findOne({ name: /warehouse/i });
        if (!warehouseShift) {
            warehouseShift = await ShiftSchedule.create({
                name: 'Warehouse Standard Shift',
                startTime: '07:00',
                endTime: '16:00',
                lunchDuration: 60,
                lateGracePeriod: 15,
                earlyGracePeriod: 30,
                workingType: 'Standard'
            });
        }

        // 2. Perform auto-mappings based on rosterGroup
        // Map Office Roster
        const officeUpdated = await Employee.updateMany(
            { rosterGroup: 'Office' },
            { assignedShift: officeShift._id }
        );

        // Map Warehouse Roster
        const warehouseUpdated = await Employee.updateMany(
            { rosterGroup: 'Warehouse' },
            { assignedShift: warehouseShift._id }
        );

        // Map Retail Roster (assign to Retail Morning Shift by default)
        const retailUpdated = await Employee.updateMany(
            { rosterGroup: 'Retail' },
            { assignedShift: retailMorning._id }
        );

        res.status(200).json({
            success: true,
            message: 'Auto-mapping completed successfully',
            summary: {
                officeAssigned: officeUpdated.modifiedCount,
                warehouseAssigned: warehouseUpdated.modifiedCount,
                retailAssigned: retailUpdated.modifiedCount
            }
        });

    } catch (error) {
        next(error);
    }
};
