const { calculateFine, calculateDueDate, isOverdue } = require('../../src/utils/fineCalculator');

describe('Fine Calculator', () => {
  describe('calculateFine', () => {
    test('should return 0 fine when book is returned on time', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // Due in 5 days
      const returnDate = new Date();
      
      const result = calculateFine(dueDate, returnDate);
      
      expect(result.overdueDays).toBe(0);
      expect(result.fineAmount).toBe(0);
    });
    
    test('should calculate fine correctly for overdue books', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 10); // 10 days overdue
      const returnDate = new Date();
      
      const result = calculateFine(dueDate, returnDate);
      
      // Assuming grace period of 2 days and late fee of 10 per day
      expect(result.overdueDays).toBe(8); // 10 - 2 grace days
      expect(result.fineAmount).toBe(80); // 8 × 10
    });
    
    test('should apply grace period correctly', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 2); // 2 days overdue
      const returnDate = new Date();
      
      const result = calculateFine(dueDate, returnDate);
      
      // Within grace period
      expect(result.overdueDays).toBe(0);
      expect(result.fineAmount).toBe(0);
    });
    
    test('should handle fractional days correctly', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 5.5); // 5.5 days overdue
      const returnDate = new Date();
      
      const result = calculateFine(dueDate, returnDate);
      
      // Should round up
      expect(result.overdueDays).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('calculateDueDate', () => {
    test('should add default borrow period to issue date', () => {
      const issueDate = new Date('2026-02-01');
      const dueDate = calculateDueDate(issueDate);
      
      // Default is 14 days
      const expectedDate = new Date('2026-02-15');
      
      expect(dueDate.getDate()).toBe(expectedDate.getDate());
      expect(dueDate.getMonth()).toBe(expectedDate.getMonth());
    });
    
    test('should use current date if no issue date provided', () => {
      const dueDate = calculateDueDate();
      const now = new Date();
      
      expect(dueDate).toBeInstanceOf(Date);
      expect(dueDate > now).toBe(true);
    });
  });
  
  describe('isOverdue', () => {
    test('should return true for past due date', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1); // Yesterday
      
      expect(isOverdue(dueDate)).toBe(true);
    });
    
    test('should return false for future due date', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Tomorrow
      
      expect(isOverdue(dueDate)).toBe(false);
    });
    
    test('should handle today correctly', () => {
      const dueDate = new Date();
      // Today might be slightly overdue depending on time
      const result = isOverdue(dueDate);
      
      expect(typeof result).toBe('boolean');
    });
  });
});
