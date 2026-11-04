const mongoose = require('mongoose');

const REASONS = ['spam', 'harassment', 'hate', 'nudity', 'violence', 'misinformation', 'other'];

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user'],
      required: true,
    },
    // id of the post, comment or user being reported
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // post containing the comment, for comment reports
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    reason: {
      type: String,
      enum: REASONS,
      required: true,
    },
    details: {
      type: String,
      maxlength: [500, 'Details cannot exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    action: {
      type: String,
      enum: ['none', 'delete_content', 'ban_user'],
      default: 'none',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// one report per user per target
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
module.exports.REASONS = REASONS;
