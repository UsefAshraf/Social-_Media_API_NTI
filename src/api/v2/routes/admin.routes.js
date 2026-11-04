const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const validate = require('../../../shared/middleware/validate');
const { resolveReportSchema, banUserSchema } = require('../validators/report.validator');
const { protect, authorize } = require('../../../shared/middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', adminController.getStats);

router.get('/reports', adminController.getReports);

router.patch('/reports/:id', validate(resolveReportSchema), adminController.resolveReport);

router.delete('/posts/:id', adminController.deletePost);

router.patch('/users/:id/ban', validate(banUserSchema), adminController.banUser);

module.exports = router;
