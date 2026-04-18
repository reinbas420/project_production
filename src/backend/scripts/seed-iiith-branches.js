'use strict';

/**
 * seed-iiith-branches.js
 *
 * Inserts synthetic library branches near IIIT Hyderabad (within 8 km).
 * Does NOT wipe existing data — safe to run at any time.
 *
 * Usage:  node scripts/seed-iiith-branches.js
 */

const mongoose = require('mongoose');
const config   = require('../src/config');
const LibraryBranch = require('../src/models/LibraryBranch');

// IIIT Hyderabad: 17.4450° N, 78.3489° E
// All coordinates are [longitude, latitude]
const BRANCHES = [
  {
    name: 'Gachibowli Branch',
    address: 'Plot 14, Gachibowli Main Road, Gachibowli, Hyderabad – 500032',
    location: { type: 'Point', coordinates: [78.3471, 17.4416] }, // ~0.5 km SW
    librarian: 'Ananya Reddy',
    BranchMailId: 'gachibowli@hlcl.lib',
    serviceRadiusKm: 8,
    status: 'ACTIVE',
  },
  {
    name: 'Kondapur Branch',
    address: '42 Kondapur Main Road, Kondapur, Hyderabad – 500084',
    location: { type: 'Point', coordinates: [78.3620, 17.4600] }, // ~2.4 km NE
    librarian: 'Suresh Varma',
    BranchMailId: 'kondapur@hlcl.lib',
    serviceRadiusKm: 8,
    status: 'ACTIVE',
  },
  {
    name: 'Manikonda Branch',
    address: '7 Manikonda Village Road, Manikonda, Hyderabad – 500089',
    location: { type: 'Point', coordinates: [78.3780, 17.4040] }, // ~6.0 km SE
    librarian: 'Kavitha Nair',
    BranchMailId: 'manikonda@hlcl.lib',
    serviceRadiusKm: 8,
    status: 'ACTIVE',
  },
  {
    name: 'Nanakramguda Branch',
    address: '88 Financial District, Nanakramguda, Hyderabad – 500032',
    location: { type: 'Point', coordinates: [78.3310, 17.4280] }, // ~2.1 km W
    librarian: 'Vikram Sinha',
    BranchMailId: 'nanakramguda@hlcl.lib',
    serviceRadiusKm: 8,
    status: 'ACTIVE',
  },
  {
    name: 'Tellapur Branch',
    address: '3 Tellapur Township Road, Tellapur, Hyderabad – 502032',
    location: { type: 'Point', coordinates: [78.3150, 17.4680] }, // ~4.5 km NW
    librarian: 'Pooja Iyer',
    BranchMailId: 'tellapur@hlcl.lib',
    serviceRadiusKm: 8,
    status: 'ACTIVE',
  },
];

const run = async () => {
  await mongoose.connect(config.mongodb.uri);
  console.log('✅ Connected to MongoDB');

  let inserted = 0;
  let skipped  = 0;

  for (const branch of BRANCHES) {
    const exists = await LibraryBranch.findOne({ BranchMailId: branch.BranchMailId });
    if (exists) {
      console.log(`⏭️  Skipping "${branch.name}" — already exists`);
      skipped++;
      continue;
    }
    await LibraryBranch.create(branch);
    console.log(`✅ Created "${branch.name}" at [${branch.location.coordinates}]`);
    inserted++;
  }

  console.log(`\n🏛️  Done — ${inserted} inserted, ${skipped} skipped`);
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
