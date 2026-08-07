/*
 * Makes the two login accounts correct, without deleting anything.
 *
 * seed.js cannot do this job: it wipes every user, topic and language tab, so a
 * deploy may only run it on a fresh database. That leaves a gap — on an existing
 * database the login page can end up prefilled with guest credentials that no
 * account actually has, and "Login as Guest" fails with "Invalid credentials".
 * This script closes that gap and is safe to run on every deploy.
 *
 * Run with:  node ensure-accounts.js       (or DRY_RUN=1 to preview)
 *
 * Two accounts, two deliberately different policies:
 *
 *   testuser  the public guest account. Its password is prefilled on the login
 *             page and therefore ships in the JavaScript bundle, so it is not a
 *             secret. It is FORCED to DEMO_USER_PASSWORD every run, because the
 *             prefilled form is only usable if the account matches it exactly.
 *
 *   admin     a real account. Created if missing, then LEFT ALONE — if you change
 *             the admin password later, a deploy must not silently revert it.
 *             Pass RESET_ADMIN_PASSWORD=yes to overwrite it deliberately.
 *
 * Nothing here touches topics, language tabs, or any other user.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

// Must match `demoLogin.password` in learning-platform/src/environments/
// environment.prod.ts, which is what the login page prefills.
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'GuestDemo123';
const DRY_RUN = process.env.DRY_RUN === '1';
const RESET_ADMIN = process.env.RESET_ADMIN_PASSWORD === 'yes';

const log = (msg) => console.log(`${DRY_RUN ? '[dry-run] ' : ''}${msg}`);

async function ensureAccounts() {
  if (!process.env.MONGODB_URI) {
    console.error('Refusing to run: MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  log('Connected to MongoDB');

  // ---- guest account: always forced to the prefilled password ----------------
  // Matched on username first, then email, so an account created under either
  // identity is repaired rather than duplicated (both fields are unique indexes,
  // so a blind create would throw).
  let guest = await User.findOne({ username: 'testuser' });
  if (!guest) guest = await User.findOne({ email: 'user@example.com' });

  const guestHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);

  if (guest) {
    // failedLoginAttempts/lockUntil are cleared too: a visitor who tripped the
    // lockout on the shared guest account would otherwise lock it for everyone.
    if (!DRY_RUN) {
      await User.updateOne(
        { _id: guest._id },
        { $set: { password: guestHash, failedLoginAttempts: 0, lockUntil: null } }
      );
    }
    log(`guest  : reset  "${guest.username}" to the prefilled password`);
  } else {
    if (!DRY_RUN) {
      await User.create({
        username: 'testuser',
        email: 'user@example.com',
        password: guestHash,
        role: 'user'
      });
    }
    log('guest  : created "testuser"');
  }

  // ---- admin account: create if missing, otherwise leave it be ---------------
  const admin = await User.findOne({ username: 'admin' });

  if (!admin) {
    const adminPlain = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPlain || adminPlain.length < 8) {
      console.error(
        'admin  : MISSING, and cannot be created — set SEED_ADMIN_PASSWORD ' +
        '(8+ characters) and re-run. The guest account above is unaffected.'
      );
      await mongoose.connection.close();
      process.exit(1);
    }
    if (!DRY_RUN) {
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: await bcrypt.hash(adminPlain, 10),
        role: 'admin'
      });
    }
    log('admin  : created (password from SEED_ADMIN_PASSWORD)');
  } else if (RESET_ADMIN) {
    const adminPlain = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPlain || adminPlain.length < 8) {
      console.error('admin  : RESET_ADMIN_PASSWORD=yes needs SEED_ADMIN_PASSWORD (8+ chars).');
      await mongoose.connection.close();
      process.exit(1);
    }
    if (!DRY_RUN) {
      await User.updateOne(
        { _id: admin._id },
        {
          $set: {
            password: await bcrypt.hash(adminPlain, 10),
            failedLoginAttempts: 0,
            lockUntil: null
          }
        }
      );
    }
    log('admin  : password reset (RESET_ADMIN_PASSWORD=yes)');
  } else {
    log('admin  : already exists — password left unchanged');
  }

  log(`total users: ${await User.countDocuments()}`);
  await mongoose.connection.close();
  process.exit(0);
}

ensureAccounts().catch((err) => {
  console.error('ensure-accounts failed:', err.message);
  process.exit(1);
});
