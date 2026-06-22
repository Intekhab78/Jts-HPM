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
const Role = require('./models/Role');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected...');

        // Ensure roles exist
        const roleNames = ['admin', 'hr', 'manager', 'finance', 'employee', 'director'];
        const roleMap = {};

        for (const name of roleNames) {
            let role = await Role.findOne({ name });
            if (!role) {
                const perms = name === 'admin' ? [
                    { module: 'employees', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'leaves', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'payroll', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'attendance', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'roles', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'appraisal', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'travel', actions: { view: true, modify: true, delete: true, approve: true } }
                ] : [];
                role = await Role.create({
                    name,
                    isSystem: name === 'admin',
                    permissions: perms
                });
                console.log(`Created role: ${name}`);
            }
            roleMap[name] = role._id;
        }

        // Clear existing users
        await User.deleteMany({});
        console.log('Cleared existing users');

        // Create users
        for (const userData of seedUsers) {
            const roleId = roleMap[userData.role];
            if (!roleId) {
                throw new Error(`Role not found: ${userData.role}`);
            }
            const user = await User.create({
                ...userData,
                role: roleId
            });
            console.log(`Created: ${user.email} (${userData.role}) — Password: ${userData.password}`);
        }

        console.log('\n✅ Seed complete! You can now login with any of the above credentials.');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error.message);
        process.exit(1);
    }
}

seed();
