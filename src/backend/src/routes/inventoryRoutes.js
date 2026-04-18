const express = require('express');
const multer  = require('multer');
const inventoryController = require('../controllers/inventoryController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const router = express.Router();

// Multer: store uploaded spreadsheet in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
      'text/csv',
      'application/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are accepted'), false);
    }
  },
});

// Validation schemas
const addCopiesSchema = Joi.object({
  bookId: Joi.string().required(),
  branchId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  condition: Joi.string().valid('GOOD', 'FAIR', 'POOR').default('GOOD'),
  shelf: Joi.string().max(100).optional(),
  rack: Joi.string().max(100).optional(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED').optional(),
  condition: Joi.string().valid('GOOD', 'FAIR', 'POOR').optional(),
  shelf: Joi.string().max(100).optional(),
  rack: Joi.string().max(100).optional(),
}).min(1);

// All routes require authentication and LIBRARIAN/ADMIN role
router.use(protect);
router.use(restrictTo('LIBRARIAN', 'ADMIN'));

router.post('/', validate(addCopiesSchema), inventoryController.addBookCopies);
router.put('/:copyId', validate(updateStatusSchema), inventoryController.updateCopyStatus);
router.get('/book/:bookId', inventoryController.getBookInventory);
router.get('/branch/:branchId', inventoryController.getInventoryByBranch);
router.get('/branch/:branchId/stats', inventoryController.getBranchStats);

// Bulk import: POST /inventory/bulk-import
// multipart/form-data  with fields: file (spreadsheet) + branchId (string)
router.post(
  '/bulk-import',
  upload.single('file'),
  inventoryController.bulkImportCopies,
);

module.exports = router;
