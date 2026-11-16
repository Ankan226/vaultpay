require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  await connectDB();
  const accounts = [
    {
      name: 'Evelyn Croft',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@nexus.test',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
      role: 'admin',
      company: 'Nexus Corporate Services',
    },
    {
      name: 'John Carter',
      email: process.env.SEED_CLIENT_EMAIL || 'client@acme.test',
      password: process.env.SEED_CLIENT_PASSWORD || 'Client@12345',
      role: 'client',
      company: 'Acme Industries',
    },
  ];
  for (const a of accounts) {
    if (!(await User.findOne({ email: a.email }))) {
      await User.create(a);
      console.log(`Created ${a.role}: ${a.email}`);
    } else console.log(`Exists: ${a.email}`);
  }
  process.exit(0);
})();