const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Employee = require('./models/Employee');
    const User = require('./models/User');
    const Role = require('./models/Role');

    const empRole = await Role.findOne({ name: 'employee' });
    const employees = await Employee.find();

    let count = 0;

    for (const emp of employees) {
        let loginEmail = emp.email;
        if (!loginEmail || loginEmail.trim() === '') {
            loginEmail = `${emp.employeeId.toLowerCase()}@hrpayroll.com`;
        }

        const existingUser = await User.findOne({ email: loginEmail });
        if (!existingUser) {
            const password = emp.employeeId || 'welcome123';
            await User.create({
                name: emp.firstName + ' ' + emp.lastName,
                email: loginEmail,
                password: password,
                role: empRole._id,
                employeeRef: emp._id
            });
            console.log('Recreated User for:', loginEmail, 'Pass:', password);
            count++;
        }
    }

    console.log(`Sync complete. Restored ${count} employee accounts.`);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
