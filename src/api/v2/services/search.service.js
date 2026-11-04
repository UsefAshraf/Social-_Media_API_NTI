const User = require('../../../shared/models/User');
const Post = require('../../../shared/models/Post');
const { escapeRegex } = require('../../../shared/utils/text');
const { hiddenUserIds } = require('./block.service');

const searchUsers = (q, limit, hidden) =>
  User.find({ username: { $regex: `^${escapeRegex(q)}`, $options: 'i' }, _id: { $nin: hidden } })
    .select('username avatar')
    .sort({ username: 1 })
    .limit(limit);

const searchPosts = (q, limit, hidden) =>
  Post.find({ $text: { $search: q }, author: { $nin: hidden } }, { score: { $meta: 'textScore' } })
    .populate('author', 'username avatar')
    .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
    .limit(limit);

const searchHashtags = (q, limit) =>
  Post.aggregate([
    { $match: { hashtags: { $regex: `^${escapeRegex(q.toLowerCase())}` } } },
    { $unwind: '$hashtags' },
    { $match: { hashtags: { $regex: `^${escapeRegex(q.toLowerCase())}` } } },
    { $group: { _id: '$hashtags', posts: { $sum: 1 } } },
    { $sort: { posts: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, tag: '$_id', posts: 1 } },
  ]);

const search = async (rawQuery, { type = 'all', limit = 10, viewerId } = {}) => {
  let q = rawQuery.trim();
  // "#tag" searches hashtags, "@name" searches users
  if (q.startsWith('#')) [type, q] = ['hashtags', q.slice(1)];
  else if (q.startsWith('@')) [type, q] = ['users', q.slice(1)];

  limit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const want = (t) => type === 'all' || type === t;
  const hidden = viewerId ? await hiddenUserIds(viewerId) : [];

  const [users, posts, hashtags] = await Promise.all([
    want('users') ? searchUsers(q, limit, hidden) : [],
    want('posts') ? searchPosts(q, limit, hidden) : [],
    want('hashtags') ? searchHashtags(q, limit) : [],
  ]);

  return { users, posts, hashtags };
};

module.exports = { search };
