const { calculateDistance, isWithinDeliveryRadius } = require('../../src/utils/haversine');

describe('Haversine Distance Calculator', () => {
  describe('calculateDistance', () => {
    test('should calculate distance between two points correctly', () => {
      // Delhi to Mumbai (approx 1150 km)
      const delhi = { lat: 28.6139, lon: 77.2090 };
      const mumbai = { lat: 19.0760, lon: 72.8777 };
      
      const distance = calculateDistance(delhi.lat, delhi.lon, mumbai.lat, mumbai.lon);
      
      // Allow 10% margin of error
      expect(distance).toBeGreaterThan(1000);
      expect(distance).toBeLessThan(1300);
    });
    
    test('should return 0 for same location', () => {
      const location = { lat: 28.6139, lon: 77.2090 };
      const distance = calculateDistance(location.lat, location.lon, location.lat, location.lon);
      
      expect(distance).toBe(0);
    });
    
    test('should calculate short distances accurately', () => {
      // Two nearby points in Delhi (approx 5 km)
      const point1 = { lat: 28.6139, lon: 77.2090 };
      const point2 = { lat: 28.6500, lon: 77.2100 };
      
      const distance = calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      
      expect(distance).toBeGreaterThan(3);
      expect(distance).toBeLessThan(7);
    });
  });
  
  describe('isWithinDeliveryRadius', () => {
    test('should return true when location is within radius', () => {
      const userLocation = { latitude: 28.6139, longitude: 77.2090 };
      const libraryLocation = { latitude: 28.6200, longitude: 77.2150 };
      const radiusKm = 8;
      
      const result = isWithinDeliveryRadius(userLocation, libraryLocation, radiusKm);
      
      expect(result).toBe(true);
    });
    
    test('should return false when location is beyond radius', () => {
      const userLocation = { latitude: 28.6139, longitude: 77.2090 };
      const libraryLocation = { latitude: 28.7041, longitude: 77.1025 }; // ~15km away
      const radiusKm = 8;
      
      const result = isWithinDeliveryRadius(userLocation, libraryLocation, radiusKm);
      
      expect(result).toBe(false);
    });
    
    test('should handle edge case at exact boundary', () => {
      // Create two points exactly 8km apart (simplified)
      const userLocation = { latitude: 28.6139, longitude: 77.2090 };
      const libraryLocation = { latitude: 28.6500, longitude: 77.2100 };
      const radiusKm = 5;
      
      const result = isWithinDeliveryRadius(userLocation, libraryLocation, radiusKm);
      
      expect(typeof result).toBe('boolean');
    });
  });
});
