/**
 * seed-librarians.js
 * Upserts the three librarian accounts without wiping any existing data.
 * Run with: node scripts/seed-librarians.js
 */

const mongoose = require('mongoose');
const config   = require('../src/config');
const User     = require('../src/models/User');
const Auth     = require('../src/models/Auth');

const ACCOUNTS = [
  {
    name:     'Admin User',
    email:    'admin@library.com',
    phone:    '9999999999',
    password: 'admin123',
    role:     'ADMIN',
    branch:   'N/A',
  },
  {
    name:     'Rajesh Kumar',
    email:    'librarian@library.com',
    phone:    '9999999998',
    password: 'librarian123',
    role:     'LIBRARIAN',
    branch:   'Central Library (Connaught Place, New Delhi)',
  },
  {
    name:     'Priya Sharma',
    email:    'librarian.north@library.com',
    phone:    '9999999997',
    password: 'librarian123',
    role:     'LIBRARIAN',
    branch:   'North Delhi Library (Model Town)',
  },
  {
    name:     'Anil Verma',
    email:    'librarian.south@library.com',
    phone:    '9999999996',
    password: 'librarian123',
    role:     'LIBRARIAN',
    branch:   'South Delhi Library (Lajpat Nagar)',
  },
];

const run = async () => {
  await mongoose.connect(config.mongodb.uri);
  console.log('✅ Connected to MongoDB\n');

  for (const lib of ACCOUNTS) {
    // Upsert User record
    let user = await User.findOne({ email: lib.email });
    if (!user) {
      user = await User.create({
        email:        lib.email,
        phone:        lib.phone,
        status:       'ACTIVE',
        emailVerified: true,
        role:         lib.role,
        profiles: [{
          name:        lib.name,
          accountType: 'PARENT',
        }],
      });
      console.log(`👤 Created user: ${lib.name} (${lib.email})`);
    } else {
      // Ensure role is correct in case they existed with wrong role
      user.role         = lib.role;
      user.emailVerified = true;
      await user.save();
      console.log(`🔄 Updated existing user: ${lib.name} (${lib.email})`);
    }

    // Upsert Auth record — password hashing handled by pre-save hook
    const existingAuth = await Auth.findOne({ email: lib.email });
    if (!existingAuth) {
      await Auth.create({
        email:    lib.email,
        password: lib.password,
        userId:   user._id,
      });
      console.log(`🔑 Created auth for: ${lib.email}`);
    } else {
      // Reset password in case it changed
      existingAuth.password = lib.password;
      await existingAuth.save();
      console.log(`🔑 Reset password for: ${lib.email}`);
    }

    console.log(`   Branch : ${lib.branch}\n`);
  }

  console.log('────────────────────────────────────');
  console.log('✅ Admin + Librarian seeding complete!\n');
  console.log('Credentials:');
  for (const lib of ACCOUNTS) {
    console.log(`  ${lib.name}`);
    console.log(`    Email   : ${lib.email}`);
    console.log(`    Password: ${lib.password}`);
    console.log(`    Branch  : ${lib.branch}\n`);
  }

  process.exit(0);
};

run().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
