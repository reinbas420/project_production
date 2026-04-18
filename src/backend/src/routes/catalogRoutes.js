const express = require('express');
const catalogController = require('../controllers/catalogController');

const router = express.Router();

router.get('/authors/search', catalogController.searchAuthors);
router.get('/authors/:authorKey', catalogController.getAuthorDetails);
router.get('/publishers/search', catalogController.searchPublishers);
router.get('/publishers/details', catalogController.getPublisherDetails);

module.exports = router;
