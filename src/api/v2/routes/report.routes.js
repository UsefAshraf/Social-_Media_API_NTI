const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const validate = require('../../../shared/middleware/validate');
const { createReportSchema } = require('../validators/report.validator');
const { protect } = require('../../../shared/middleware/auth');

router.post('/', protect, validate(createReportSchema), reportController.createReport);

module.exports = router;
