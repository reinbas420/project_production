/**
 * Calculate distance between two points using Haversine formula
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lon1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lon2 - Longitude of point 2
 * @returns {Number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 * @param {Number} degrees 
 * @returns {Number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Check if location is within delivery radius of a library
 * @param {Object} userLocation - {latitude, longitude}
 * @param {Object} libraryLocation - {latitude, longitude}
 * @param {Number} radiusKm - Maximum delivery radius
 * @returns {Boolean}
 */
function isWithinDeliveryRadius(userLocation, libraryLocation, radiusKm) {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    libraryLocation.latitude,
    libraryLocation.longitude
  );
  
  return distance <= radiusKm;
}

module.exports = {
  calculateDistance,
  isWithinDeliveryRadius,
  toRadians
};
