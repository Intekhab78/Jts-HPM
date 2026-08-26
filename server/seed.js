const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedUsers = [
    { name: 'Admin User', email: 'admin@hrpayroll.com', password: 'admin123', role: 'admin' },
    { name: 'HR Manager', email: 'hr@hrpayroll.com', password: 'hr1234', role: 'hr' },
    { name: 'John Manager', email: 'manager@hrpayroll.com', password: 'manager123', role: 'manager' },
    { name: 'Finance User', email: 'finance@hrpayroll.com', password: 'finance123', role: 'finance' },
    { name: 'Ahmed Employee', email: 'employee@hrpayroll.com', password: 'employee123', role: 'employee' },
    { name: 'Director User', email: 'director@hrpayroll.com', password: 'director123', role: 'director' },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected...');

        // Clear existing users
        await User.deleteMany({});
        console.log('Cleared existing users');

        // Create users
        for (const userData of seedUsers) {
            const user = await User.create(userData);
            console.log(`Created: ${user.email} (${user.role}) — Password: ${userData.password}`);
        }

        console.log('\n✅ Seed complete! You can now login with any of the above credentials.');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error.message);
        process.exit(1);
    }
}

seed();
