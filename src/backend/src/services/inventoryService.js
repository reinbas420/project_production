const BookCopy = require('../models/BookCopy');
const Book = require('../models/Book');
const LibraryBranch = require('../models/LibraryBranch');
const AppError = require('../utils/AppError');
const bookMetadataService = require('./bookMetadataService');
const XLSX = require('xlsx');

/**
 * Add book copies to inventory
 */
exports.addBookCopies = async (
  bookId,
  branchId,
  quantity,
  condition = "GOOD",
  shelf = "UNASSIGNED",
  rack = "UNASSIGNED",
) => {
  const branch = await LibraryBranch.findById(branchId);

  if (!branch) {
    throw new AppError("Library branch not found", 404);
  }

  const copies = [];

  for (let i = 0; i < quantity; i++) {
    const barcode = `${branchId}-${bookId}-${Date.now()}-${i}`;

    const copy = await BookCopy.create({
      bookId,
      branchId,
      barcode,
      condition,
      shelf,
      rack,
    });

    copies.push(copy);
  }

  return copies;
};

/**
 * Update book copy status
 */
exports.updateCopyStatus = async (copyId, updateData = {}) => {
  const allowedUpdates = ["status", "condition", "shelf", "rack"];
  const updates = {};
  Object.keys(updateData).forEach((key) => {
    if (allowedUpdates.includes(key) && updateData[key] !== undefined) {
      updates[key] = updateData[key];
    }
  });

  const copy = await BookCopy.findByIdAndUpdate(
    copyId,
    updates,
    { new: true, runValidators: true },
  );

  if (!copy) {
    throw new AppError("Book copy not found", 404);
  }

  return copy;
};

/**
 * Get inventory by branch
 */
exports.getInventoryByBranch = async (branchId) => {
  const inventory = await BookCopy.find({ branchId })
    .populate("bookId")
    .sort("-createdAt");

  return inventory;
};

/**
 * Get available copies for a book at a branch
 */
exports.getAvailableCopies = async (bookId, branchId, session = null) => {
  let query = BookCopy.find({
    bookId,
    branchId,
    status: "AVAILABLE",
  });
  if (session) query = query.session(session);

  return await query;
};

/**
 * Mark copy as issued
 */
exports.markAsIssued = async (copyId, session = null) => {
  let query = BookCopy.findById(copyId);
  if (session) query = query.session(session);
  const copy = await query;

  if (!copy) {
    throw new AppError("Book copy not found", 404);
  }

  if (copy.status !== "AVAILABLE") {
    throw new AppError("Book copy is not available", 400);
  }

  copy.status = "ISSUED";
  copy.lastIssuedAt = new Date();
  await copy.save({ session });

  return copy;
};

/**
 * Mark copy as returned
 */
exports.markAsReturned = async (copyId) => {
  const copy = await BookCopy.findById(copyId);

  if (!copy) {
    throw new AppError("Book copy not found", 404);
  }

  copy.status = "AVAILABLE";
  copy.lastReturnedAt = new Date();
  await copy.save();

  return copy;
};

/**
 * Get inventory for a single book broken down by branch.
 * Returns one summary object per branch that has at least one copy of the book.
 */
exports.getBookInventoryByBranch = async (bookId) => {
  const copies = await BookCopy.find({ bookId })
    .populate('branchId', 'name address')
    .lean();

  const branchMap = {};
  for (const copy of copies) {
    const branch = copy.branchId;
    if (!branch) continue;
    const id = branch._id.toString();
    if (!branchMap[id]) {
      branchMap[id] = {
        branchId: id,
        branchName: branch.name || 'Unknown',
        total: 0,
        available: 0,
        issued: 0,
        damaged: 0,
        lost: 0,
      };
    }
    branchMap[id].total++;
    switch (copy.status) {
      case 'AVAILABLE': branchMap[id].available++; break;
      case 'ISSUED':    branchMap[id].issued++;    break;
      case 'DAMAGED':   branchMap[id].damaged++;   break;
      case 'LOST':      branchMap[id].lost++;      break;
    }
  }

  return Object.values(branchMap);
};

/**
 * Get inventory stats for a branch
 */
exports.getBranchInventoryStats = async (branchId) => {
  const totalBooks = await BookCopy.countDocuments({ branchId });
  const availableBooks = await BookCopy.countDocuments({
    branchId,
    status: "AVAILABLE",
  });
  const issuedBooks = await BookCopy.countDocuments({
    branchId,
    status: "ISSUED",
  });
  const damagedBooks = await BookCopy.countDocuments({
    branchId,
    status: "DAMAGED",
  });
  const lostBooks = await BookCopy.countDocuments({ branchId, status: "LOST" });

  return {
    total: totalBooks,
    available: availableBooks,
    issued: issuedBooks,
    damaged: damagedBooks,
    lost: lostBooks,
  };
};

// ---------------------------------------------------------------------------
// Bulk Import from Excel / CSV buffer
// ---------------------------------------------------------------------------

/**
 * Supported column names (case-insensitive):
 *
 *   Required:   Quantity
 *   Identifier: ISBN  -OR-  Title   (at least one is needed)
 *   Fallback:   Author, Genre (semicolon-separated), Language,
 *               Summary, MinAge, Condition
 *
 * Resolution order per row:
 *   1. ISBN present  →  fetchByISBN   (Google Books + Open Library)
 *   2. ISBN missing or fetch returned nothing  →  fetchByTitle  (if Title given)
 *   3. Merge: API result is primary; Excel columns fill any remaining nulls.
 *   4. Validate minimum required fields (title, author, summary).
 *   5. Find-or-create Book document; mint `quantity` BookCopy records.
 *
 * Rows are processed SEQUENTIALLY to stay within Google Books rate limits.
 */
exports.bulkImport = async (fileBuffer, branchId) => {
  // -- Validate branch -------------------------------------------------------
  const branch = await LibraryBranch.findById(branchId);
  if (!branch) throw new AppError('Library branch not found', 404);

  // -- Parse spreadsheet -----------------------------------------------------
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  // header:1  → first row becomes the column-index key; defval:'' → no undefined cells
  const rawRows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows.length) throw new AppError('Spreadsheet is empty', 400);

  const headerRow = rawRows[0].map(h => String(h).trim().toLowerCase());
  const dataRows  = rawRows.slice(1);

  // Helper: extract a cell from a row by column name
  const col = (row, name) => {
    const idx = headerRow.indexOf(name.toLowerCase());
    return idx !== -1 ? String(row[idx] ?? '').trim() : '';
  };

  if (!headerRow.includes('quantity')) {
    throw new AppError('Spreadsheet must have a "Quantity" column', 400);
  }

  const results = { importedCount: 0, skippedCount: 0, errors: [] };

  // -- Process rows sequentially ---------------------------------------------
  for (let i = 0; i < dataRows.length; i++) {
    const row       = dataRows[i];
    const rowNumber = i + 2; // human-readable (header = row 1)

    if (row.every(cell => String(cell).trim() === '')) continue; // skip blanks

    try {
      // Extract Excel columns
      const isbnRaw   = col(row, 'isbn');
      const titleRaw  = col(row, 'title');
      const quantity  = parseInt(col(row, 'quantity'), 10);
      const condition = (col(row, 'condition').toUpperCase() || 'GOOD');

      // Excel-only fallback fields
      const excelAuthor  = col(row, 'author');
      const excelGenre   = col(row, 'genre').split(';').map(g => g.trim()).filter(Boolean);
      const excelLang    = col(row, 'language') || 'English';
      const excelSummary = col(row, 'summary');
      const excelMinAge  = col(row, 'minage') !== '' ? parseInt(col(row, 'minage'), 10) : null;

      // Basic guard checks
      if (!isbnRaw && !titleRaw) {
        results.errors.push({ row: rowNumber, reason: 'Row must have at least an ISBN or Title' });
        results.skippedCount++;
        continue;
      }
      if (isNaN(quantity) || quantity < 1) {
        results.errors.push({ row: rowNumber, isbn: isbnRaw, title: titleRaw, reason: 'Invalid or missing Quantity' });
        results.skippedCount++;
        continue;
      }
      const VALID_CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'NEW', 'DAMAGED'];
      if (!VALID_CONDITIONS.includes(condition)) {
        results.errors.push({ row: rowNumber, isbn: isbnRaw, title: titleRaw, reason: `Unknown condition "${condition}" — use: ${VALID_CONDITIONS.join(', ')}` });
        results.skippedCount++;
        continue;
      }

      // Step 1: ISBN fetch (primary)
      let fetched = null;
      if (isbnRaw) {
        fetched = await bookMetadataService.fetchByISBN(isbnRaw);
        if (!fetched) {
          console.warn(`[BulkImport] Row ${rowNumber}: ISBN "${isbnRaw}" not found online — will try title.`);
        }
      }

      // Step 2: Title fetch (secondary)
      if (!fetched && titleRaw) {
        fetched = await bookMetadataService.fetchByTitle(titleRaw);
        if (!fetched) {
          console.warn(`[BulkImport] Row ${rowNumber}: Title "${titleRaw}" not found online — using Excel data only.`);
        }
      }

      // Step 3: Smart merge (API is primary, Excel fills nulls)
      const merged = {
        title:         fetched?.title         || titleRaw   || null,
        author:        fetched?.author        || excelAuthor || null,
        isbn:          fetched?.isbn          || (isbnRaw ? Number(isbnRaw) : null),
        genre:         fetched?.genre?.length  ? fetched.genre : excelGenre,
        language:      fetched?.language      || excelLang,
        summary:       fetched?.summary       || excelSummary || null,
        coverImage:    fetched?.coverImage    || null,
        pageCount:     fetched?.pageCount     || null,
        publisher:     fetched?.publisher     || null,
        publishedDate: fetched?.publishedDate || null,
        minAge:        fetched?.minAge        ?? excelMinAge ?? 0,
      };

      // Step 4: Validate minimum required fields
      const missing = [];
      if (!merged.title)   missing.push('title');
      if (!merged.author)  missing.push('author');
      if (!merged.summary) missing.push('summary');

      if (missing.length) {
        results.errors.push({
          row:    rowNumber,
          isbn:   isbnRaw  || undefined,
          title:  titleRaw || undefined,
          reason: `Could not resolve required fields: ${missing.join(', ')}. Add them to the spreadsheet or verify the ISBN/Title.`,
        });
        results.skippedCount++;
        continue;
      }

      // Step 5: Find or create the Book document
      let book;
      if (merged.isbn) {
        book = await Book.findOne({ isbn: merged.isbn });
      }
      if (!book) {
        // Escape special regex chars before building case-insensitive match
        const escTitle  = merged.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escAuthor = merged.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        book = await Book.findOne({
          title:  { $regex: new RegExp(`^${escTitle}$`,  'i') },
          author: { $regex: new RegExp(`^${escAuthor}$`, 'i') },
        });
      }
      if (!book) {
        book = await Book.create({
          title:         merged.title,
          author:        merged.author,
          isbn:          merged.isbn,
          genre:         merged.genre,
          language:      merged.language,
          summary:       merged.summary,
          coverImage:    merged.coverImage,
          pageCount:     merged.pageCount,
          publishedDate: merged.publishedDate,
          minAge:        merged.minAge,
        });
      }

      // Step 6: Mint BookCopy records (insertMany for efficiency)
      const copies = [];
      for (let c = 0; c < quantity; c++) {
        copies.push({
          bookId:    book._id,
          branchId,
          barcode:   `${branchId}-${book._id}-${Date.now()}-${c}`,
          // 'NEW' is not a valid BookCopy condition schema value; map it to GOOD
          condition: condition === 'NEW' ? 'GOOD' : condition,
          status:    'AVAILABLE',
        });
      }
      await BookCopy.insertMany(copies);

      results.importedCount++;

    } catch (err) {
      console.error(`[BulkImport] Row ${rowNumber} unexpected error:`, err.message);
      results.errors.push({ row: rowNumber, reason: err.message || 'Unexpected server error' });
      results.skippedCount++;
    }
  }

  return results;
};
