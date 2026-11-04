const mongoose = require('mongoose');
const { extractHashtags } = require('../utils/text');

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    // set on replies; threads are one level deep
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      maxlength: [1000, 'Post content cannot exceed 1000 characters'],
    },
    image: {
      type: String,
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [commentSchema],
    hashtags: [
      {
        type: String,
        index: true,
      },
    ],
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

postSchema.index({ content: 'text' });

postSchema.pre('validate', function (next) {
  if (this.isModified('content')) {
    this.hashtags = extractHashtags(this.content);
  }
  next();
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
