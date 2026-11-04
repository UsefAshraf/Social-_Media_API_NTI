const Post = require('../../../shared/models/Post');
const { parsePagination, paginationMeta } = require('../../../shared/utils/pagination');
const { encodeCursor, olderThan } = require('../../../shared/utils/cursor');

// Newest-first page of posts matching `filter`.
// With ?cursor= it uses keyset pagination, otherwise ?page= offsets.
const listPosts = async (filter, query) => {
  const paging = parsePagination(query);
  const useCursor = Boolean(query.cursor);

  const posts = await Post.find(useCursor ? { $and: [filter, olderThan(query.cursor)] } : filter)
    .populate('author', 'username avatar')
    .populate('comments.author', 'username avatar')
    .sort({ createdAt: -1, _id: -1 })
    .skip(useCursor ? 0 : paging.skip)
    .limit(paging.limit + 1) // one extra to know if there is a next page
    .lean(); // plain objects: same JSON, much cheaper than full documents

  const hasMore = posts.length > paging.limit;
  const page = posts.slice(0, paging.limit);
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

  if (useCursor) {
    return { data: page, pagination: { limit: paging.limit, nextCursor } };
  }

  const total = await Post.countDocuments(filter);
  return { data: page, pagination: { ...paginationMeta(paging, total), nextCursor } };
};

module.exports = { listPosts };
