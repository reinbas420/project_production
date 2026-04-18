const libraryService = require('../services/libraryService');
const catchAsync = require('../utils/catchAsync');

/**
 * Get all libraries
 * GET /libraries
 */
exports.getAllLibraries = catchAsync(async (req, res) => {
  const filters = {
    organizationId: req.query.organizationId,
    includeInactive: req.query.includeInactive === 'true',
    latitude: req.query.lat !== undefined ? parseFloat(req.query.lat) : undefined,
    longitude: req.query.lng !== undefined ? parseFloat(req.query.lng) : undefined,
  };
  
  const libraries = await libraryService.getAllLibraries(filters);
  
  res.status(200).json({
    status: 'success',
    results: libraries.length,
    data: { libraries }
  });
});

/**
 * Get library by ID
 * GET /libraries/:libraryId
 */
exports.getLibrary = catchAsync(async (req, res) => {
  const library = await libraryService.getLibraryById(req.params.libraryId);
  
  res.status(200).json({
    status: 'success',
    data: { library }
  });
});

/**
 * Create new library
 * POST /libraries
 */
exports.createLibrary = catchAsync(async (req, res) => {
  const library = await libraryService.createLibrary(req.body);
  
  res.status(201).json({
    status: 'success',
    data: { library }
  });
});

/**
 * Update library
 * PUT /libraries/:libraryId
 */
exports.updateLibrary = catchAsync(async (req, res) => {
  const library = await libraryService.updateLibrary(req.params.libraryId, req.body);
  
  res.status(200).json({
    status: 'success',
    data: { library }
  });
});

/**
 * Get nearby libraries
 * GET /libraries/nearby
 */
exports.getNearbyLibraries = catchAsync(async (req, res) => {
  const userLocation = {
    latitude: parseFloat(req.query.lat),
    longitude: parseFloat(req.query.lng)
  };
  
  const maxDistance = parseFloat(req.query.maxDistance) || 10;
  
  const libraries = await libraryService.getNearbyLibraries(userLocation, maxDistance);
  
  res.status(200).json({
    status: 'success',
    results: libraries.length,
    data: { libraries }
  });
});
