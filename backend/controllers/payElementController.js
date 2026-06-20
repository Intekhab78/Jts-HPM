const PayElement = require('../models/PayElement');

exports.getPayElements = async (req, res, next) => {
    try {
        const elements = await PayElement.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: elements.length, data: elements });
    } catch (error) {
        next(error);
    }
};

exports.getPayElement = async (req, res, next) => {
    try {
        const element = await PayElement.findById(req.params.id);
        if (!element) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, data: element });
    } catch (error) {
        next(error);
    }
};

exports.createPayElement = async (req, res, next) => {
    try {
        const element = await PayElement.create(req.body);
        res.status(201).json({ success: true, data: element });
    } catch (error) {
        next(error);
    }
};

exports.updatePayElement = async (req, res, next) => {
    try {
        const element = await PayElement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!element) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, data: element });
    } catch (error) {
        next(error);
    }
};

exports.deletePayElement = async (req, res, next) => {
    try {
        const element = await PayElement.findByIdAndDelete(req.params.id);
        if (!element) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
