'use strict';

/**
 * seed-books.js
 *
 * Fetches metadata for 25 well-known ISBNs from Google Books / Open Library
 * and adds them to every existing LibraryBranch (3-4 copies each).
 *
 * Safe to re-run:  already-existing ISBNs are skipped.
 *
 * Usage:  node scripts/seed-books.js
 */

const mongoose          = require('mongoose');
const config            = require('../src/config');
const Book              = require('../src/models/Book');
const BookCopy          = require('../src/models/BookCopy');
const LibraryBranch     = require('../src/models/LibraryBranch');
const bookMetadataService = require('../src/services/bookMetadataService');

// ─── 25 popular ISBNs across varied genres ────────────────────────────────────
const ISBNS = [
  // ── Science Fiction ────────────────────────────────
  '9780441013593', // Dune — Frank Herbert
  '9780060512439', // Ender's Game — Orson Scott Card
  '9780345391803', // The Hitchhiker's Guide to the Galaxy — Douglas Adams
  '9780063021501', // Project Hail Mary — Andy Weir
  '9780385333481', // Neuromancer — William Gibson

  // ── Fantasy ────────────────────────────────────────
  '9780618346257', // The Fellowship of the Ring — Tolkien (50th ann.)
  '9780439023481', // The Hunger Games — Suzanne Collins
  '9780553573404', // A Game of Thrones — G.R.R. Martin

  // ── Literary Fiction ───────────────────────────────
  '9780062316097', // The Alchemist — Paulo Coelho
  '9780743273565', // To Kill a Mockingbird — Harper Lee
  '9780451524935', // 1984 — George Orwell
  '9780316769174', // The Catcher in the Rye — J.D. Salinger
  '9780385490818', // The Handmaid's Tale — Margaret Atwood
  '9780525559023', // The Midnight Library — Matt Haig

  // ── Mystery / Thriller ─────────────────────────────
  '9780062420497', // And Then There Were None — Agatha Christie
  '9780525559474', // The Silent Patient — Alex Michaelides

  // ── Non-Fiction / Science ─────────────────────────
  '9780062316110', // Sapiens — Yuval Noah Harari
  '9780553380163', // A Brief History of Time — Stephen Hawking
  '9780374533557', // Thinking, Fast and Slow — Daniel Kahneman

  // ── Self-help / Finance ────────────────────────────
  '9780735211292', // Atomic Habits — James Clear
  '9781612681139', // Rich Dad Poor Dad — Robert Kiyosaki
  '9780062457714', // The Subtle Art of Not Giving a F*ck — Mark Manson

  // ── Indian Literature ─────────────────────────────
  '9780143114574', // The God of Small Things — Arundhati Roy
  '9780670919567', // The White Tiger — Aravind Adiga

  // ── Biography / Memoir ────────────────────────────
  '9781451648539', // Steve Jobs — Walter Isaacson
];

// ─── Copies per branch ────────────────────────────────────────────────────────
const COPIES_PER_BRANCH = 4;

// ─── Condition rotation ───────────────────────────────────────────────────────
const CONDITIONS = ['GOOD', 'GOOD', 'GOOD', 'FAIR'];

// ─────────────────────────────────────────────────────────────────────────────

const run = async () => {
  await mongoose.connect(config.mongodb.uri);
  console.log('✅ Connected to MongoDB\n');

  // Fetch all active branches
  const branches = await LibraryBranch.find({ status: 'ACTIVE' }).lean();
  if (branches.length === 0) {
    console.error('❌ No active branches found — run seed-iiith-branches.js first');
    process.exit(1);
  }
  console.log(`🏛️  Found ${branches.length} branch(es): ${branches.map(b => b.name).join(', ')}\n`);

  let booksDone = 0, booksSkipped = 0, copiesCreated = 0;

  for (const isbn of ISBNS) {
    process.stdout.write(`📖 [${isbn}] `);

    // ── Skip if already in DB ──────────────────────────────────────────────
    const existing = await Book.findOne({ isbn });
    if (existing) {
      console.log(`⏭️  Already exists: "${existing.title}"`);
      booksSkipped++;
      continue;
    }

    // ── Fetch metadata ────────────────────────────────────────────────────
    let meta;
    try {
      meta = await bookMetadataService.fetchByISBN(isbn);
    } catch (err) {
      console.log(`⚠️  Metadata fetch error — ${err.message}`);
      continue;
    }

    if (!meta || !meta.title || !meta.author) {
      console.log('⚠️  No usable metadata returned — skipping');
      continue;
    }

    // ── Create Book record ────────────────────────────────────────────────
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

    // ── Create BookCopy records for every branch ──────────────────────────
    const copies = [];
    for (const branch of branches) {
      for (let i = 0; i < COPIES_PER_BRANCH; i++) {
        const barcode = `${branch.name.replace(/\s+/g, '').toUpperCase().slice(0, 8)}-${book._id}-${i}`;
        copies.push({
          bookId:    book._id,
          branchId:  branch._id,
          barcode,
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
    booksDone++;

    // Short pause to respect Google Books rate limit (~1 req/s is safe)
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seeding complete
   Books added   : ${booksDone}
   Books skipped : ${booksSkipped}
   Copies created: ${copiesCreated}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
