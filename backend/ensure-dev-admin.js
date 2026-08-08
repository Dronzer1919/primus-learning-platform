/*
 * Creates (or repairs) the local-only "devadmin" account used by the login
 * page's "Login as Admin (Dev)" button (see learning-platform/src/environments/
 * environment.ts -> devAdminLogin). Never run against a production database —
 * this is purely a local development convenience, separate from any real
 * user's account or password.
 *
 * Run with:  node ensure-dev-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

// Must match devAdminLogin in learning-platform/src/environments/environment.ts.
const USERNAME = 'devadmin';
const EMAIL = 'devadmin@example.local';
const PASSWORD = 'DevAdmin123!';

async function ensureDevAdmin() {
  if (!process.env.MONGODB_URI) {
    console.error('Refusing to run: MONGODB_URI is not set.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run with NODE_ENV=production.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const hash = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ username: USERNAME });

  if (existing) {
    await User.updateOne(
      { _id: existing._id },
      { $set: { password: hash, role: 'admin', failedLoginAttempts: 0, lockUntil: null } }
    );
    console.log(`devadmin: reset password/role on existing account`);
  } else {
    await User.create({ username: USERNAME, email: EMAIL, password: hash, role: 'admin' });
    console.log('devadmin: created');
  }

  await mongoose.connection.close();
  process.exit(0);
}

ensureDevAdmin().catch((err) => {
  console.error('ensure-dev-admin failed:', err.message);
  process.exit(1);
});
