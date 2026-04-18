const Book = require("../models/Book");
const BookCopy = require("../models/BookCopy");
const AppError = require("../utils/AppError");
const bookMetadataService = require("./bookMetadataService");
const s3Service = require("./s3Service");
const axios = require("axios");

const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2-preview";
const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || "768", 10);

const buildBookEmbeddingText = (bookData = {}) => {
  const genreText = Array.isArray(bookData.genre) ? bookData.genre.join(", ") : String(bookData.genre || "");
  const chatbotTagsText = Array.isArray(bookData.chatbotTags)
    ? bookData.chatbotTags.map((tag) => String(tag).trim()).filter(Boolean).join(", ")
    : String(bookData.chatbotTags || "");

  return [
    `Title: ${bookData.title || ""}`,
    `Author: ${bookData.author || ""}`,
    `Genre: ${genreText}`,
    `Language: ${bookData.language || ""}`,
    `ChatbotTags: ${chatbotTagsText}`,
    `Summary: ${bookData.summary || ""}`,
  ].join("\n").trim();
};

const getGeminiEmbedding = async (text) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new AppError("Missing GEMINI_API_KEY/GOOGLE_API_KEY for embedding generation", 500);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`;

  const response = await axios.post(
    url,
    {
      content: {
        parts: [{ text }],
      },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSION,
    },
    { timeout: 90000 }
  );

  const embedding = response.data?.embedding?.values;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new AppError(`Invalid Gemini embedding response: ${JSON.stringify(response.data)}`, 502);
  }

  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new AppError(
      `Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`,
      502
    );
  }

  return embedding;
};

const parseAgeRatingMin = (ageRating) => {
  if (!ageRating) return null;
  const value = String(ageRating).trim();
  const rangeMatch = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  const plusMatch = value.match(/^(\d+)\+$/);
  if (plusMatch) return parseInt(plusMatch[1], 10);
  return null;
};

const toAgeRating = (minAge) => {
  const age = Number(minAge);
  if (!Number.isFinite(age) || age < 0) return '0-99';
  if (age <= 3) return '0-3';
  if (age <= 6) return '4-6';
  if (age <= 8) return '6-8';
  if (age <= 10) return '8-10';
  if (age <= 12) return '10-12';
  if (age <= 15) return '12-15';
  return `${Math.floor(age)}-99`;
};

const addAgeFilterToQuery = (query, filters = {}) => {
  if (filters.maxAge === undefined && filters.minAge === undefined) {
    return;
  }

  const exprParts = [];
  const ageExpr = {
    $ifNull: [
      '$minAge',
      {
        $convert: {
          input: {
            $arrayElemAt: [
              { $split: [{ $ifNull: ['$ageRating', '0-99'] }, '-'] },
              0,
            ],
          },
          to: 'int',
          onError: 0,
          onNull: 0,
        },
      },
    ],
  };

  if (filters.maxAge !== undefined) {
    const maxAge = parseInt(filters.maxAge, 10);
    if (!isNaN(maxAge)) {
      exprParts.push({ $lte: [ageExpr, maxAge] });
    }
  }

  if (filters.minAge !== undefined) {
    const minAge = parseInt(filters.minAge, 10);
    if (!isNaN(minAge)) {
      exprParts.push({ $gte: [ageExpr, minAge] });
    }
  }

  if (exprParts.length === 1) {
    query.$expr = exprParts[0];
  } else if (exprParts.length > 1) {
    query.$expr = { $and: exprParts };
  }
};

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

const buildGeneratedTags = (bookData = {}) => {
  const tags = new Set();

  tokenize(bookData.title).forEach((tag) => tags.add(tag));
  tokenize(bookData.author).forEach((tag) => tags.add(tag));
  tokenize(bookData.language).forEach((tag) => tags.add(tag));

  if (Array.isArray(bookData.genre)) {
    bookData.genre.forEach((genre) => {
      tokenize(genre).forEach((tag) => tags.add(tag));
      const normalizedGenre = String(genre || "").trim().toLowerCase();
      if (normalizedGenre) tags.add(normalizedGenre);
    });
  }

  tokenize(bookData.summary)
    .slice(0, 20)
    .forEach((tag) => tags.add(tag));

  return Array.from(tags).slice(0, 50);
};

async function getBranchScope(filters = {}) {
  const mongoose = require("mongoose");
  let branchIds = Array.isArray(filters.branchIds) && filters.branchIds.length > 0
    ? filters.branchIds
    : filters.branchId
      ? [filters.branchId]
      : [];

  // Radial filtering: If no specific branch is selected but user coords are provided,
  // limit scope to branches within 8km.
  if (branchIds.length === 0 && filters.lat && filters.lng) {
    const LibraryBranch = require("../models/LibraryBranch");
    const { calculateDistance } = require("../utils/haversine");
    const lat = parseFloat(filters.lat);
    const lng = parseFloat(filters.lng);

    const allBranches = await LibraryBranch.find({ status: "ACTIVE" }).lean();
    const nearby = allBranches.filter((b) => {
      if (!b.location || !b.location.coordinates) return false;
      const dist = calculateDistance(
        lat,
        lng,
        b.location.coordinates[1],
        b.location.coordinates[0],
      );
      return dist <= 8;
    });
    branchIds = nearby.map((b) => b._id.toString());
  }

  return branchIds.filter(Boolean).map(id => new mongoose.Types.ObjectId(id));
}

/**
 * Get all books with filters
 */
exports.getAllBooks = async (filters = {}) => {
  const query = {};
  const branchScopeIds = await getBranchScope(filters);

  addAgeFilterToQuery(query, filters);

  if (filters.genre) {
    query.genre = {
      $in: Array.isArray(filters.genre) ? filters.genre : [filters.genre],
    };
  }

  if (filters.language) {
    query.language = filters.language;
  }

  // Text search — use regex so stop words like "the", "a", "of" are not ignored
  if (filters.search) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    query.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { summary: searchRegex },
      { generatedTags: searchRegex },
      { chatbotTags: searchRegex },
    ];
  }

  // Contextual Library Pre-filter: derive book IDs from filtered copies first.
  if (branchScopeIds.length > 0) {
    const validBookIds = await BookCopy.find({
      branchId: { $in: branchScopeIds },
      status: "AVAILABLE",
    }).distinct("bookId");
    query._id = { $in: validBookIds };
  }

  if (filters.daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - parseInt(filters.daysAgo));
    query.createdAt = { $gte: date };
  }

  const books = await Book.find(query)
    .sort(filters.sort || "-createdAt")
    .limit(parseInt(filters.limit) || 50)
    .lean();

  // Attach available copies count from BookCopy collection and annotate branches for frontend Contextual UI
  const bookIds = books.map((b) => b._id);
  const copyMatch = { bookId: { $in: bookIds }, status: "AVAILABLE" };
  if (branchScopeIds.length > 0) {
    copyMatch.branchId = { $in: branchScopeIds };
  }

  const copiesAgg = await BookCopy.aggregate([
    { $match: copyMatch },
    { $group: { _id: "$bookId", count: { $sum: 1 }, branchIds: { $addToSet: "$branchId" } } },
  ]);
  
  const LibraryBranch = require("../models/LibraryBranch");
  const branches = await LibraryBranch.find({ status: "ACTIVE" }).lean();
  const branchMap = {};
  branches.forEach(b => branchMap[b._id.toString()] = b.name);

  const copiesMap = {};
  copiesAgg.forEach((c) => {
    copiesMap[c._id.toString()] = {
      count: c.count,
      branches: c.branchIds.map(id => id.toString()),
      branchNames: c.branchIds.map(id => branchMap[id.toString()]).filter(Boolean)
    };
  });

  books.forEach((b) => {
    const stats = copiesMap[b._id.toString()] || { count: 0, branches: [], branchNames: [] };
    b.availableCopies = stats.count;
    
    // Inject dynamic contextual rendering flags for the frontend
    if (branchScopeIds.length > 0) {
      b.availableAtSelectedBranch = stats.count > 0;
      b.otherBranchNames = [];
    } else {
      b.availableAtSelectedBranch = true;
      b.otherBranchNames = stats.branchNames;
    }
  });

  return books;
};

/**
 * Get books for a specific branch by first filtering BookCopy records.
 */
exports.getBooksForBranch = async (branchId, filters = {}) => {
  const mongoose = require("mongoose");
  // Cast to ObjectId so aggregate $match works (aggregate does NOT auto-cast like find)
  const branchOid = new mongoose.Types.ObjectId(branchId);

  const query = {};

  addAgeFilterToQuery(query, filters);

  if (filters.genre) {
    query.genre = {
      $in: Array.isArray(filters.genre) ? filters.genre : [filters.genre],
    };
  }

  if (filters.language) {
    query.language = filters.language;
  }

  if (filters.search) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    query.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { summary: searchRegex },
      { generatedTags: searchRegex },
      { chatbotTags: searchRegex },
    ];
  }

  if (filters.daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - parseInt(filters.daysAgo));
    query.createdAt = { $gte: date };
  }

  const validBookIds = await BookCopy.find({
    branchId: branchOid,
    status: "AVAILABLE",
  }).distinct("bookId");

  query._id = { $in: validBookIds };

  const books = await Book.find(query)
    .sort(filters.sort || "-createdAt")
    .limit(parseInt(filters.limit) || 50)
    .lean();

  const bookIds = books.map((b) => b._id);
  const copiesAgg = await BookCopy.aggregate([
    {
      $match: {
        bookId: { $in: bookIds },
        branchId: branchOid,
        status: "AVAILABLE",
      },
    },
    { $group: { _id: "$bookId", count: { $sum: 1 } } },
  ]);

  const copiesMap = {};
  copiesAgg.forEach((c) => {
    copiesMap[c._id.toString()] = c.count;
  });

  books.forEach((b) => {
    b.availableCopies = copiesMap[b._id.toString()] || 0;
    b.availableAtSelectedBranch = b.availableCopies > 0;
    b.otherBranchNames = [];
  });

  return books;
};

/**
 * Get book by ID
 */
exports.getBookById = async (bookId, lat, lng) => {
  const book = await Book.findById(bookId).lean();

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  // Load actual available copies count
  const copies = await BookCopy.find({
    bookId,
    status: "AVAILABLE",
  }).populate("branchId");

  if (lat !== undefined && lng !== undefined) {
    const { calculateDistance } = require("../utils/haversine");
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const localCopies = copies.filter((copy) => {
      if (!copy.branchId || copy.branchId.status !== "ACTIVE") return false;
      if (!copy.branchId.location || !copy.branchId.location.coordinates) return false;

      const distance = calculateDistance(
        userLat,
        userLng,
        copy.branchId.location.coordinates[1], // latitude
        copy.branchId.location.coordinates[0], // longitude
      );
      return distance <= 8;
    });

    book.availableCopies = localCopies.length;
    book.totalAvailable = copies.length;
  } else {
    book.availableCopies = copies.length;
    book.totalAvailable = copies.length;
  }

  return book;
};

/**
 * Create new book (Librarian/Admin only).
 * If an ISBN is provided and fields like title/summary/coverImage are missing,
 * they are auto-filled from Google Books / Open Library.
 * Librarian-supplied values always take priority over fetched data.
 */
exports.createBook = async (bookData) => {
  let data = { ...bookData };

  if (data.isbn) {
    // Check for duplicate ISBN first
    const existing = await Book.findOne({ isbn: data.isbn });
    if (existing) {
      throw new AppError(`A book with ISBN ${data.isbn} already exists`, 409);
    }

    // Auto-enrich missing fields from external APIs
    try {
      const metadata = await bookMetadataService.fetchByISBN(data.isbn);
      if (metadata) {
        // Only fill fields the librarian left blank
        data.title = data.title || metadata.title;
        data.author = data.author || metadata.author;
        data.genre = data.genre?.length ? data.genre : metadata.genre;
        data.language = data.language || metadata.language;
        data.summary = data.summary || metadata.summary;
        data.coverImage = data.coverImage || metadata.coverImage;
        data.minAge = data.minAge !== undefined ? data.minAge : metadata.minAge;
        data.ageRating = data.ageRating || metadata.ageRating || toAgeRating(data.minAge);
        data.publishedDate = data.publishedDate || metadata.publishedDate;
        // Store extra metadata not in the form
        data._metadataSource = metadata.source;
      }
    } catch (err) {
      // Metadata fetch failure must never block book creation
      console.warn(`[createBook] Metadata enrichment THREW: ${err.message}`, err.stack);
    }
  }

  // Fallback genre so the array is never empty
  if (!data.genre || data.genre.length === 0) {
    data.genre = ['General'];
  }

  // Fallback summary — summary is required in the schema
  if (!data.summary) {
    data.summary = 'No description available.';
  }

  // Upload cover to S3 for permanent self-hosted storage
  if (data.coverImage) {
    data.coverImage = await s3Service.uploadCoverFromUrl(data.isbn, data.coverImage);
  }

  if (!data.title || !data.author) {
    console.error('[createBook] FAILING — missing title or author. title:', data.title, '| author:', data.author);
    throw new AppError(
      "Could not determine title and author from ISBN — please provide them manually",
      400,
    );
  }

  if (data.minAge === undefined || data.minAge === null) {
    const parsedMin = parseAgeRatingMin(data.ageRating);
    data.minAge = parsedMin !== null ? parsedMin : 0;
  }

  if (!data.ageRating) {
    data.ageRating = toAgeRating(data.minAge);
  }

  if (!data.generatedTags || data.generatedTags.length === 0) {
    data.generatedTags = buildGeneratedTags(data);
  }

  if (!data.chatbotTags || data.chatbotTags.length === 0) {
    data.chatbotTags = [...data.generatedTags];
  }

  // Always generate embeddings on librarian/admin book creation unless explicit vectors are provided.
  if (!Array.isArray(data.plot_embeddings) || data.plot_embeddings.length === 0) {
    const embeddingText = buildBookEmbeddingText(data);
    if (!embeddingText) {
      throw new AppError("Cannot generate embedding: missing book text content", 400);
    }

    const embedding = await getGeminiEmbedding(embeddingText);
    data.plot_embeddings = embedding;
    data.plot_embeddings_dim = embedding.length;
    data.embedding_provider = GEMINI_EMBED_MODEL;
    data.embedding_title = data.title;
    data.embedding_author = data.author;
    data.embedding_migrated_at = new Date();
  }

  // Remove internal tracking field before saving
  delete data._metadataSource;

  const book = await Book.create(data);
  return book;
};

/**
 * Update book (Librarian/Admin only)
 */
exports.updateBook = async (bookId, updateData) => {
  if (updateData.ageRating && (updateData.minAge === undefined || updateData.minAge === null)) {
    const parsedMin = parseAgeRatingMin(updateData.ageRating);
    if (parsedMin !== null) {
      updateData.minAge = parsedMin;
    }
  }

  if (updateData.minAge !== undefined && !updateData.ageRating) {
    updateData.ageRating = toAgeRating(updateData.minAge);
  }

  const shouldRegenerateTags = ["title", "author", "genre", "language", "summary"].some(
    (field) => updateData[field] !== undefined,
  );

  const shouldRegenerateEmbedding = ["title", "author", "genre", "language", "summary", "chatbotTags"].some(
    (field) => updateData[field] !== undefined,
  );
  const hasCustomEmbedding = Array.isArray(updateData.plot_embeddings) && updateData.plot_embeddings.length > 0;

  let existing = null;
  if ((shouldRegenerateTags && !updateData.generatedTags) || (shouldRegenerateEmbedding && !hasCustomEmbedding)) {
    existing = await Book.findById(bookId).lean();
    if (!existing) throw new AppError("Book not found", 404);
  }

  if (shouldRegenerateTags && !updateData.generatedTags) {
    const merged = { ...existing, ...updateData };
    updateData.generatedTags = buildGeneratedTags(merged);
  }

  if (shouldRegenerateTags && !updateData.chatbotTags) {
    updateData.chatbotTags = [...(updateData.generatedTags || [])];
  }

  if (shouldRegenerateEmbedding && !hasCustomEmbedding) {
    const merged = { ...existing, ...updateData };
    if (!merged.summary) {
      merged.summary = "No description available.";
    }

    const embeddingText = buildBookEmbeddingText(merged);
    if (!embeddingText) {
      throw new AppError("Cannot regenerate embedding: missing book text content", 400);
    }

    const embedding = await getGeminiEmbedding(embeddingText);
    updateData.plot_embeddings = embedding;
    updateData.plot_embeddings_dim = embedding.length;
    updateData.embedding_provider = GEMINI_EMBED_MODEL;
    updateData.embedding_title = merged.title;
    updateData.embedding_author = merged.author;
    updateData.embedding_migrated_at = new Date();
  }

  if (hasCustomEmbedding && !updateData.plot_embeddings_dim) {
    updateData.plot_embeddings_dim = updateData.plot_embeddings.length;
  }

  const book = await Book.findByIdAndUpdate(bookId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  return book;
};

/**
 * Delete book (Admin only)
 */
exports.deleteBook = async (bookId) => {
  const book = await Book.findByIdAndDelete(bookId);

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  // Delete S3 cover if it was uploaded there
  if (book.coverImage) {
    await s3Service.deleteCover(book.coverImage);
  }

  // Also delete all copies
  await BookCopy.deleteMany({ bookId });

  return { message: "Book deleted successfully" };
};

/**
 * Look up book metadata by ISBN without creating a book record.
 * Used by the frontend to preview data before the librarian confirms.
 */
exports.lookupByISBN = async (isbn) => {
  if (!isbn) throw new AppError("ISBN is required", 400);

  const existing = await Book.findOne({ isbn: String(isbn).replace(/[-\s]/g, "") });

  const metadata = await bookMetadataService.fetchByISBN(isbn);
  if (!metadata) {
    throw new AppError(`No metadata found for ISBN: ${isbn}`, 404);
  }

  return {
    metadata,
    alreadyInCatalog: !!existing,
    existingBookId: existing?._id || null,
  };
};

/**
 * Check book availability in nearby libraries
 */
exports.checkAvailability = async (bookId, userLocation) => {
  const LibraryBranch = require("../models/LibraryBranch");
  const { calculateDistance } = require("../utils/haversine");
  const config = require("../config");

  // Find all copies of this book
  const copies = await BookCopy.find({
    bookId,
    status: "AVAILABLE",
  }).populate("branchId");

  // Filter branches within delivery radius
  const availableInBranches = [];

  for (const copy of copies) {
    if (!copy.branchId || copy.branchId.status !== "ACTIVE") continue;
    if (!copy.branchId.location || !copy.branchId.location.coordinates)
      continue;

    let distance = 0;
    let isWithinReach = true;

    // Only calculate distance if user location is valid
    if (
      userLocation.latitude &&
      userLocation.longitude &&
      !isNaN(userLocation.latitude) &&
      !isNaN(userLocation.longitude)
    ) {
      distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        copy.branchId.location.coordinates[1], // latitude
        copy.branchId.location.coordinates[0], // longitude
      );
      isWithinReach = distance <= config.business.deliveryRadiusKm;
    } else {
      // No user location — show all branches, mark distance as unknown
      distance = 0;
      isWithinReach = true;
    }

    const existingBranch = availableInBranches.find(
      (b) => b.branchId.toString() === copy.branchId._id.toString(),
    );

    if (existingBranch) {
      existingBranch.availableCopies++;
    } else {
      availableInBranches.push({
        branchId: copy.branchId._id,
        branchName: copy.branchId.name,
        address: copy.branchId.address,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        availableCopies: 1,
        isWithinReach,
      });
    }
  }

  // Sort by distance
  availableInBranches.sort((a, b) => a.distance - b.distance);

  return {
    bookId,
    totalAvailable: availableInBranches.reduce(
      (sum, b) => sum + b.availableCopies,
      0,
    ),
    branches: availableInBranches,
  };
};

/**
 * Get books by age rating
 */
exports.getBooksByAge = async (minAge) => {
  const books = await Book.find({
    $expr: {
      $lte: [
        {
          $ifNull: [
            '$minAge',
            {
              $convert: {
                input: {
                  $arrayElemAt: [
                    { $split: [{ $ifNull: ['$ageRating', '0-99'] }, '-'] },
                    0,
                  ],
                },
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
          ],
        },
        minAge,
      ],
    },
  }).sort("-createdAt");
  return books;
};
