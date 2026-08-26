const Holiday = require('../models/Holiday');

// @desc    Get all holidays
// @route   GET /api/holidays
// @access  Private
exports.getHolidays = async (req, res, next) => {
    try {
        const { year } = req.query;
        let query = {};

        if (year) {
            const startDate = new Date(`${year}-01-01`);
            const endDate = new Date(`${year}-12-31T23:59:59`);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const holidays = await Holiday.find(query).sort({ date: 1 });
        res.status(200).json({ success: true, count: holidays.length, data: holidays });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new holiday
// @route   POST /api/holidays
// @access  Admin, HR
exports.createHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.create(req.body);
        res.status(201).json({ success: true, data: holiday });
    } catch (error) {
        // Handle explicit duplicate date errors gracefully
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'A holiday already exists on this exact date' });
        }
        next(error);
    }
};

// @desc    Update a holiday
// @route   PUT /api/holidays/:id
// @access  Admin, HR
exports.updateHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        res.status(200).json({ success: true, data: holiday });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a holiday
// @route   DELETE /api/holidays/:id
// @access  Admin, HR
exports.deleteHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.findByIdAndDelete(req.params.id);

        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
