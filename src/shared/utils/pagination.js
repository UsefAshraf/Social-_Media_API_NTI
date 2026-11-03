// Parse ?page=&limit= safely: positive integers, limit capped at max
const parsePagination = (query, { defaultLimit = 10, max = 50 } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), max);

  return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

module.exports = {
  parsePagination,
  paginationMeta,
};
