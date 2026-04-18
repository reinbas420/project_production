const catchAsync = require('../utils/catchAsync');
const openLibraryService = require('../services/openLibraryService');

exports.searchAuthors = catchAsync(async (req, res) => {
  const authors = await openLibraryService.searchAuthors(req.query.q, req.query.limit);

  res.status(200).json({
    status: 'success',
    results: authors.length,
    data: { authors },
  });
});

exports.getAuthorDetails = catchAsync(async (req, res) => {
  const author = await openLibraryService.getAuthorDetails(req.params.authorKey);

  res.status(200).json({
    status: 'success',
    data: { author },
  });
});

exports.searchPublishers = catchAsync(async (req, res) => {
  const publishers = await openLibraryService.searchPublishers(req.query.q, req.query.limit);

  res.status(200).json({
    status: 'success',
    results: publishers.length,
    data: { publishers },
  });
});

exports.getPublisherDetails = catchAsync(async (req, res) => {
  const publisher = await openLibraryService.getPublisherDetails(req.query.name);

  res.status(200).json({
    status: 'success',
    data: { publisher },
  });
});
