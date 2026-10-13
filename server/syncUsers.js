const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const Employee = require('./models/Employee');
        const User = require('./models/User');

        const emps = await Employee.find();

        for (const emp of emps) {
            let emailUsed = emp.email;

            // Generate corporate email if missing
            if (!emailUsed) {
                const cleanLast = emp.lastName ? emp.lastName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                emailUsed = `${emp.firstName.toLowerCase()}.${cleanLast}@jtsmiddleeast.com`.replace('..', '.');
                emp.email = emailUsed;
                await emp.save();
                console.log(`Updated Employee ${emp.firstName}: Assigned Email ${emailUsed}`);
            }

            // Sync the User Account
            const user = await User.findOne({ employeeRef: emp._id });
            if (user) {
                user.email = emailUsed;
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash('password123', salt);
                await user.save();
                console.log(`Synced User Account: ${user.email} (Password: password123)`);
            }
        }

        console.log('--- DB Sync Complete ---');
        process.exit(0);
    })
    .catch(console.error);
