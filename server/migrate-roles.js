require('dotenv').config();
const { MongoClient } = require('mongodb');

async function migrate() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();
        const usersCollection = db.collection('users');
        const rolesCollection = db.collection('roles');

        const baseRoles = ['admin', 'hr', 'manager', 'finance', 'employee'];
        const roleCache = {};

        for (const r of baseRoles) {
            let roleDoc = await rolesCollection.findOne({ name: r });

            if (!roleDoc) {
                const isSys = r === 'admin';
                const perms = r === 'admin' ? [
                    { module: 'employees', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'leaves', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'payroll', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'attendance', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'roles', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'appraisal', actions: { view: true, modify: true, delete: true, approve: true } },
                    { module: 'travel', actions: { view: true, modify: true, delete: true, approve: true } }
                ] : [];

                const res = await rolesCollection.insertOne({
                    name: r,
                    isSystem: isSys,
                    permissions: perms,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                roleDoc = { _id: res.insertedId, name: r };
                console.log('Created base role:', r);
            }
            roleCache[r] = roleDoc._id;
        }

        const users = await usersCollection.find({}).toArray();
        let count = 0;
        for (const u of users) {
            if (typeof u.role === 'string') {
                const roleId = roleCache[u.role] || roleCache['employee'];
                await usersCollection.updateOne({ _id: u._id }, { $set: { role: roleId } });
                count++;
            }
        }
        console.log('Successfully migrated ' + count + ' users to dynamic roles!');
    } finally {
        await client.close();
    }
}

migrate().catch(console.error);
