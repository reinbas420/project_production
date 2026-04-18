const circulationService = require('../services/circulationService');
const catchAsync = require('../utils/catchAsync');

/**
 * Issue a book
 * POST /issues
 */
exports.issueBook = catchAsync(async (req, res) => {
  const issueData = {
    userId: req.user._id,
    profileId: req.body.profileId,
    bookId: req.body.bookId,
    branchId: req.body.branchId,
    type: req.body.type || 'PHYSICAL'
  };

  const result = await circulationService.issueBook(issueData);

  res.status(201).json({
    status: 'success',
    data: result
  });
});

/**
 * Return a book
 * PUT /issues/:issueId/return
 */
exports.returnBook = catchAsync(async (req, res) => {
  const result = await circulationService.returnBook(req.params.issueId);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get all issues (Librarian/Admin)
 * GET /issues
 */
exports.getAllIssues = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
  };

  const issues = await circulationService.getAllIssues(filters);

  res.status(200).json({
    status: 'success',
    results: issues.length,
    data: { issues }
  });
});

/**
 * Get user issues
 * GET /users/:userId/issues
 */
exports.getUserIssues = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    profileId: req.query.profileId
  };

  const issues = await circulationService.getUserIssues(req.params.userId, filters);

  res.status(200).json({
    status: 'success',
    results: issues.length,
    data: { issues }
  });
});

/**
 * Get issue details
 * GET /issues/:issueId
 */
exports.getIssue = catchAsync(async (req, res) => {
  const result = await circulationService.getIssueById(req.params.issueId);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get book issue history (Librarian)
 * GET /books/:bookId/history
 */
exports.getBookHistory = catchAsync(async (req, res) => {
  const history = await circulationService.getBookIssueHistory(req.params.bookId);

  res.status(200).json({
    status: 'success',
    results: history.length,
    data: { history }
  });
});
