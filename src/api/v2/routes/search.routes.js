const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const validate = require('../../../shared/middleware/validate');
const { searchQuerySchema } = require('../validators/search.validator');
const { protect } = require('../../../shared/middleware/auth');

router.get('/', protect, validate(searchQuerySchema, 'query'), searchController.search);

module.exports = router;
