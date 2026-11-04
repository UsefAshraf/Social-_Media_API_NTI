const Post = require('../../../shared/models/Post');

const HOUR = 60 * 60 * 1000;
const clamp = (value, min, max, fallback) => Math.min(Math.max(Number(value) || fallback, min), max);

const trendingPosts = async ({ hours, limit, hidden = [] } = {}) => {
  hours = clamp(hours, 1, 168, 48);
  limit = clamp(limit, 1, 50, 10);
  const now = new Date();

  const posts = await Post.aggregate([
    { $match: { createdAt: { $gte: new Date(now - hours * HOUR) }, author: { $nin: hidden } } },
    {
      $addFields: {
        engagement: { $add: [{ $size: '$likes' }, { $multiply: [2, { $size: '$comments' }] }] },
        ageHours: { $divide: [{ $subtract: [now, '$createdAt'] }, HOUR] },
      },
    },
    { $match: { engagement: { $gt: 0 } } },
    { $addFields: { score: { $divide: ['$engagement', { $pow: [{ $add: ['$ageHours', 2] }, 1.5] }] } } },
    { $sort: { score: -1, createdAt: -1 } },
    { $limit: limit },
    { $project: { ageHours: 0, comments: 0 } },
  ]);

  return Post.populate(posts, { path: 'author', select: 'username avatar' });
};

const trendingHashtags = ({ hours, limit } = {}) => {
  hours = clamp(hours, 1, 168, 24);
  limit = clamp(limit, 1, 50, 10);

  return Post.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - hours * HOUR) }, 'hashtags.0': { $exists: true } } },
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', posts: { $sum: 1 }, authors: { $addToSet: '$author' } } },
    // a tag used by many people ranks above one person spamming it
    { $project: { _id: 0, tag: '$_id', posts: 1, authors: { $size: '$authors' } } },
    { $sort: { authors: -1, posts: -1, tag: 1 } },
    { $limit: limit },
  ]);
};

module.exports = {
  trendingPosts,
  trendingHashtags,
};
