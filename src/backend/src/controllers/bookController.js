const bookService = require("../services/bookService");
const catchAsync = require("../utils/catchAsync");

/**
 * Get all books
 * GET /books
 */
exports.getAllBooks = catchAsync(async (req, res) => {
  const branchIds = typeof req.query.branchIds === 'string' && req.query.branchIds.trim()
    ? req.query.branchIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  const filters = {
    // Range-based age filter: show books where ageRating minimum ≤ maxAge.
    // maxAge is the child profile's upper age bound (e.g. 10 for ageGroup "8-10").
    maxAge:   req.query.maxAge !== undefined ? parseInt(req.query.maxAge, 10) : undefined,
    // minAge hides children-only books from adult users (e.g. minAge=13 excludes "4-8" books).
    minAge:   req.query.minAge !== undefined ? parseInt(req.query.minAge, 10) : undefined,
    genre:    req.query.genre,
    language: req.query.language,
    search:   req.query.search,
    sort:     req.query.sort,
    limit:    req.query.limit,
    daysAgo:  req.query.daysAgo,
    branchId: req.query.branchId,
    branchIds,
    lat:      req.query.lat,
    lng:      req.query.lng,
  };

  const books = await bookService.getAllBooks(filters);

  res.status(200).json({
    status: "success",
    results: books.length,
    data: { books },
  });
});

/**
 * Get books for a specific branch
 * GET /books/branch/:branchId
 */
exports.getBranchBooks = catchAsync(async (req, res) => {
  const filters = {
    maxAge: req.query.maxAge !== undefined ? parseInt(req.query.maxAge, 10) : undefined,
    minAge: req.query.minAge !== undefined ? parseInt(req.query.minAge, 10) : undefined,
    genre: req.query.genre,
    language: req.query.language,
    search: req.query.search,
    sort: req.query.sort,
    limit: req.query.limit,
    daysAgo: req.query.daysAgo,
  };

  const books = await bookService.getBooksForBranch(req.params.branchId, filters);

  res.status(200).json({
    status: "success",
    results: books.length,
    data: { books },
  });
});

/**
 * Get Smart AI Recommendations
 * GET /books/smart-recommendations
 */
exports.getSmartRecommendations = catchAsync(async (req, res) => {
  const { branchId, profileId, userId } = req.query;
  const aiService = require('../services/aiService');
  const recommendations = await aiService.getSmartRecommendations(userId, profileId, branchId);
  res.status(200).json({
    status: "success",
    results: recommendations.length,
    data: { books: recommendations },
  });
});

/**
 * Chat with Owl AI
 * POST /books/chat
 */
exports.chatWithOwl = catchAsync(async (req, res) => {
  const { messages, branchId, profileId, userId } = req.body;
  const aiService = require('../services/aiService');
  const reply = await aiService.chatWithOwl(userId, profileId, branchId, messages);
  res.status(200).json({
    status: "success",
    data: { reply },
  });
});

/**
 * Chat with Owl AI (Streaming SSE)
 * POST /books/chat/stream
 */
exports.streamChatWithOwl = catchAsync(async (req, res) => {
  const { messages, branchId, profileId, userId } = req.body;
  const aiService = require('../services/aiService');
  
  // Establish Server-Sent Events Connection
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const stream = await aiService.streamChatWithOwl(userId, profileId, branchId, messages);

  for await (const chunk of stream) {
    if (chunk) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

/**
 * Get book by ID
 * GET /books/:bookId
 */
exports.getBook = catchAsync(async (req, res) => {
  const { lat, lng } = req.query;
  const book = await bookService.getBookById(req.params.bookId, lat, lng);

  res.status(200).json({
    status: "success",
    data: { book },
  });
});

/**
 * Look up book metadata by ISBN (does not create a book).
 * GET /books/lookup?isbn=9780439708180
 */
exports.lookupByISBN = catchAsync(async (req, res) => {
  const result = await bookService.lookupByISBN(req.query.isbn);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Create new book
 * POST /books
 */
exports.createBook = catchAsync(async (req, res) => {
  const book = await bookService.createBook(req.body);

  res.status(201).json({
    status: "success",
    data: { book },
  });
});

/**
 * Update book
 * PUT /books/:bookId
 */
exports.updateBook = catchAsync(async (req, res) => {
  const book = await bookService.updateBook(req.params.bookId, req.body);

  res.status(200).json({
    status: "success",
    data: { book },
  });
});

/**
 * Delete book
 * DELETE /books/:bookId
 */
exports.deleteBook = catchAsync(async (req, res) => {
  await bookService.deleteBook(req.params.bookId);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

/**
 * Check book availability
 * GET /books/:bookId/availability
 */
exports.checkAvailability = catchAsync(async (req, res) => {
  // User location should be from user's delivery address or profile
  const userLocation = {
    latitude: parseFloat(req.query.lat),
    longitude: parseFloat(req.query.lng),
  };

  if (!userLocation.latitude || !userLocation.longitude) {
    // Get from user's delivery address (check array first, then legacy field)
    const user = req.user;

    // Check deliveryAddresses array (new model) — prefer default address
    if (user.deliveryAddresses && user.deliveryAddresses.length > 0) {
      const addr =
        user.deliveryAddresses.find((a) => a.isDefault) ||
        user.deliveryAddresses[0];
      if (addr.location && addr.location.coordinates) {
        userLocation.latitude = addr.location.coordinates[1];
        userLocation.longitude = addr.location.coordinates[0];
      }
    }

    // Fallback to legacy singular deliveryAddress
    if (
      (!userLocation.latitude || !userLocation.longitude) &&
      user.deliveryAddress &&
      user.deliveryAddress.location
    ) {
      userLocation.latitude = user.deliveryAddress.location.coordinates[1];
      userLocation.longitude = user.deliveryAddress.location.coordinates[0];
    }
  }

  const availability = await bookService.checkAvailability(
    req.params.bookId,
    userLocation,
  );

  res.status(200).json({
    status: "success",
    data: availability,
  });
});

/**
 * Get book reviews
 * GET /books/:bookId/reviews
 */
exports.getBookReviews = catchAsync(async (req, res) => {
  const bookService = require('../services/bookService');
  const book = await bookService.getBookById(req.params.bookId);

  if (!book || !book.isbn) {
    return res.status(200).json({ status: "success", data: { reviews: [] } });
  }

  const reviewService = require('../services/reviewService');
  const reviews = await reviewService.fetchAggregatedReviews(book.isbn, book._id);

  res.status(200).json({
    status: "success",
    data: { reviews },
  });
});
