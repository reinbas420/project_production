const inventoryService = require('../services/inventoryService');
const catchAsync = require('../utils/catchAsync');

/**
 * Add book copies to inventory
 * POST /inventory
 */
exports.addBookCopies = catchAsync(async (req, res) => {
  const { bookId, branchId, quantity, condition, shelf, rack } = req.body;
  
  const copies = await inventoryService.addBookCopies(bookId, branchId, quantity, condition, shelf, rack);
  
  res.status(201).json({
    status: 'success',
    data: { copies }
  });
});

/**
 * Update copy status
 * PUT /inventory/:copyId
 */
exports.updateCopyStatus = catchAsync(async (req, res) => {
  const copy = await inventoryService.updateCopyStatus(req.params.copyId, req.body);
  
  res.status(200).json({
    status: 'success',
    data: { copy }
  });
});

/**
 * Get per-branch inventory breakdown for a single book
 * GET /inventory/book/:bookId
 */
exports.getBookInventory = catchAsync(async (req, res) => {
  const inventory = await inventoryService.getBookInventoryByBranch(req.params.bookId);

  res.status(200).json({
    status: 'success',
    results: inventory.length,
    data: { inventory },
  });
});

/**
 * Get inventory by branch
 * GET /inventory/branch/:branchId
 */
exports.getInventoryByBranch = catchAsync(async (req, res) => {
  const inventory = await inventoryService.getInventoryByBranch(req.params.branchId);
  
  res.status(200).json({
    status: 'success',
    results: inventory.length,
    data: { inventory }
  });
});

/**
 * Get branch inventory stats
 * GET /inventory/branch/:branchId/stats
 */
exports.getBranchStats = catchAsync(async (req, res) => {
  const stats = await inventoryService.getBranchInventoryStats(req.params.branchId);
  
  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

/**
 * Bulk import books from an uploaded Excel / CSV file
 * POST /inventory/bulk-import
 *
 * Expects multipart/form-data with:
 *   - file     : the spreadsheet (.xlsx, .xls, or .csv)
 *   - branchId : MongoDB ObjectId of the target library branch
 */
exports.bulkImportCopies = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded. Send the spreadsheet as multipart/form-data with field name "file".' });
  }

  const { branchId } = req.body;
  if (!branchId) {
    return res.status(400).json({ status: 'fail', message: 'branchId is required in the form data.' });
  }

  const results = await inventoryService.bulkImport(req.file.buffer, branchId);

  const status = results.skippedCount === 0 ? 201 : 207; // 207 = Multi-Status (partial success)
  res.status(status).json({
    status:        results.importedCount > 0 ? 'success' : 'fail',
    importedCount: results.importedCount,
    skippedCount:  results.skippedCount,
    errors:        results.errors,
  });
});
