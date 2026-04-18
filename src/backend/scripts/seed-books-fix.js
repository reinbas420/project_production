'use strict';

/**
 * seed-books-fix.js
 *
 * Removes the 5 books that were inserted with wrong ISBNs in seed-books.js,
 * then re-seeds them with verified ISBNs.  Also adds And Then There Were None
 * and Atomic Habits which were skipped the first time.
 *
 * Usage:  node scripts/seed-books-fix.js
 */

const mongoose            = require('mongoose');
const config              = require('../src/config');
const Book                = require('../src/models/Book');
const BookCopy            = require('../src/models/BookCopy');
const LibraryBranch       = require('../src/models/LibraryBranch');
const bookMetadataService = require('../src/services/bookMetadataService');

// ISBNs whose Open Library result was NOT the intended book
const BAD_ISBNS = [
  '9780060512439', // returned "Iguana Dreams"  instead of Ender's Game
  '9780063021501', // returned "Katabasis"       instead of Project Hail Mary
  '9780062316097', // returned duplicate Sapiens  (intended: The Alchemist)
  '9780143114574', // returned NY Times Almanac  instead of God of Small Things
  '9780670919567', // returned business book     instead of The White Tiger
];

// Verified correct ISBN-13s for the intended titles
const REPLACEMENT_ISBNS = [
  '9780812550702', // Ender's Game — Orson Scott Card (Tor pb)
  '9780593135204', // Project Hail Mary — Andy Weir (Del Rey hc)
  '9780062315007', // The Alchemist — Paulo Coelho (HarperOne 25th ann)
  '9780140266856', // The God of Small Things — Arundhati Roy (Penguin)
  '9781416562603', // The White Tiger — Aravind Adiga (Free Press)
  '9780062073488', // And Then There Were None — Agatha Christie
  '9780735211292', // Atomic Habits — James Clear (retry — Open Library has it)
  '9780385472579', // To Kill a Mockingbird — Harper Lee (correct ISBN for TKAM)
  '9780062457726', // To Kill a Mockingbird — Harper Lee (another edition)
  '9780060935467', // To Kill a Mockingbird — Harper Lee (Perennial Modern Classics)
];

const COPIES_PER_BRANCH = 4;
const CONDITIONS = ['GOOD', 'GOOD', 'GOOD', 'FAIR'];

const run = async () => {
  await mongoose.connect(config.mongodb.uri);
  console.log('✅ Connected to MongoDB\n');

  const branches = await LibraryBranch.find({ status: 'ACTIVE' }).lean();
  console.log(`🏛️  ${branches.length} active branches found\n`);

  // ── Step 1: Remove bad books (and their copies) ───────────────────────────
  console.log('🗑️  Removing incorrectly seeded books…');
  for (const isbn of BAD_ISBNS) {
    const book = await Book.findOne({ isbn });
    if (!book) {
      console.log(`   ⏭️  ${isbn} not found — already clean`);
      continue;
    }
    const { deletedCount } = await BookCopy.deleteMany({ bookId: book._id });
    await Book.deleteOne({ _id: book._id });
    console.log(`   🗑️  Deleted "${book.title}" (${deletedCount} copies)`);
  }

  // ── Step 2: Add replacements ──────────────────────────────────────────────
  console.log('\n📚 Adding replacement books…');
  let added = 0, skipped = 0, copiesCreated = 0;

  for (const isbn of REPLACEMENT_ISBNS) {
    process.stdout.write(`📖 [${isbn}] `);

    const existing = await Book.findOne({ isbn });
    if (existing) {
      console.log(`⏭️  Already exists: "${existing.title}"`);
      skipped++;
      continue;
    }

    let meta;
    try {
      meta = await bookMetadataService.fetchByISBN(isbn);
    } catch (err) {
      console.log(`⚠️  Metadata fetch error — ${err.message}`);
      continue;
    }

    if (!meta || !meta.title || !meta.author) {
      console.log('⚠️  No usable metadata — skipping');
      continue;
    }

    let book;
    try {
      book = await Book.create({
        title:         meta.title,
        author:        meta.author,
        isbn,
        genre:         meta.genre?.length ? meta.genre : ['General'],
        language:      meta.language || 'English',
        summary:       meta.summary || 'No description available.',
        coverImage:    meta.coverImage || undefined,
        ageRating:     meta.ageRating  || '0-99',
        publishedDate: meta.publishedDate || undefined,
      });
    } catch (err) {
      console.log(`❌ Book.create error — ${err.message}`);
      continue;
    }

    console.log(`✅ "${book.title}" by ${book.author}`);

    const copies = [];
    for (const branch of branches) {
      for (let i = 0; i < COPIES_PER_BRANCH; i++) {
        copies.push({
          bookId:    book._id,
          branchId:  branch._id,
          barcode:   `${branch.name.replace(/\s+/g, '').toUpperCase().slice(0, 8)}-${book._id}-${i}`,
          status:    'AVAILABLE',
          condition: CONDITIONS[i % CONDITIONS.length],
        });
      }
    }

    try {
      await BookCopy.insertMany(copies);
      copiesCreated += copies.length;
    } catch (err) {
      console.log(`   ⚠️  Copies insert error — ${err.message}`);
    }

    console.log(`   📦 ${copies.length} copies across ${branches.length} branch(es)`);
    added++;

    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Fixup complete
   Books removed : ${BAD_ISBNS.length}
   Books added   : ${added}
   Books skipped : ${skipped}
   Copies created: ${copiesCreated}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
