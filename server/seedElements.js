const mongoose = require('mongoose');
require('dotenv').config();
const PayElement = require('./models/PayElement');

const seedElements = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('MongoDB Connected...');

        const elements = [
            { name: 'Basic Salary', type: 'Earning', description: 'Core statutory basic salary component', isActive: true },
            { name: 'Housing (HRA)', type: 'Earning', description: 'Standard Housing Allowance', isActive: true },
            { name: 'Transport', type: 'Earning', description: 'Standard Transport Allowance', isActive: true },
            { name: 'Mobile Allowance', type: 'Earning', description: 'Phone and connectivity', isActive: true },
            { name: 'Food Allowance', type: 'Earning', description: 'Daily meals/catering allowance', isActive: true },
            { name: 'Education Allowance', type: 'Earning', description: 'Child education support', isActive: true }
        ];

        for (let el of elements) {
            const exists = await PayElement.findOne({ name: el.name });
            if (!exists) {
                await PayElement.create(el);
                console.log(`+ Added: ${el.name}`);
            } else {
                console.log(`- Skipped: ${el.name} (Already exists)`);
            }
        }

        console.log('--- SEEDING COMPLETE ---');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedElements();
