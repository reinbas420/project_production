const LibraryBranch = require('../models/LibraryBranch');
const Organization = require('../models/Organization');
const AppError = require('../utils/AppError');
const { calculateDistance } = require('../utils/haversine');

/**
 * Get all libraries
 */
exports.getAllLibraries = async (filters = {}) => {
  const query = {};

  // By default only return active libraries; admins can request all
  if (!filters.includeInactive) {
    query.status = 'ACTIVE';
  }
  
  if (filters.organizationId) {
    query.organizationId = filters.organizationId;
  }

  const libraries = await LibraryBranch.find(query).populate('organizationId').lean();

  const hasUserLocation =
    Number.isFinite(filters.latitude) && Number.isFinite(filters.longitude);

  if (!hasUserLocation) {
    // Keep ordering deterministic when location is unavailable.
    return libraries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  const withDistance = libraries.map((library) => {
    const coords = library?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      return { ...library, distanceKm: null };
    }

    const distanceKm = calculateDistance(
      filters.latitude,
      filters.longitude,
      coords[1],
      coords[0],
    );

    return {
      ...library,
      distanceKm: Math.round(distanceKm * 10) / 10,
    };
  });

  withDistance.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) {
      return String(a.name).localeCompare(String(b.name));
    }
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    if (a.distanceKm === b.distanceKm) {
      return String(a.name).localeCompare(String(b.name));
    }
    return a.distanceKm - b.distanceKm;
  });

  return withDistance;
};

/**
 * Get library by ID
 */
exports.getLibraryById = async (libraryId) => {
  const library = await LibraryBranch.findById(libraryId).populate('organizationId');
  
  if (!library) {
    throw new AppError('Library not found', 404);
  }
  
  return library;
};

/**
 * Create new library (Admin only)
 */
exports.createLibrary = async (libraryData) => {
  const library = await LibraryBranch.create(libraryData);
  return library;
};

/**
 * Update library
 */
exports.updateLibrary = async (libraryId, updateData) => {
  const library = await LibraryBranch.findByIdAndUpdate(libraryId, updateData, {
    new: true,
    runValidators: true
  });
  
  if (!library) {
    throw new AppError('Library not found', 404);
  }
  
  return library;
};

/**
 * Get nearby libraries
 */
exports.getNearbyLibraries = async (userLocation, maxDistance = 10) => {
  const libraries = await LibraryBranch.find({
    status: 'ACTIVE',
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [userLocation.longitude, userLocation.latitude]
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    }
  }).populate('organizationId');
  
  return libraries;
};
