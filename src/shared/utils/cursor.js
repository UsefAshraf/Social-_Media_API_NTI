const mongoose = require('mongoose');
const ApiError = require('./ApiError');

// A cursor points just past the last item of a page: base64url("<createdAt ISO>_<_id>")
const encodeCursor = (doc) =>
  Buffer.from(`${doc.createdAt.toISOString()}_${doc._id}`).toString('base64url');

const decodeCursor = (cursor) => {
  const [iso, id] = Buffer.from(String(cursor), 'base64url').toString('utf8').split('_');
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || !mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid cursor');
  }
  return { createdAt, _id: new mongoose.Types.ObjectId(id) };
};

// Filter for documents strictly older than the cursor, newest first
const olderThan = (cursor) => {
  const { createdAt, _id } = decodeCursor(cursor);
  return { $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: _id } }] };
};

module.exports = {
  encodeCursor,
  decodeCursor,
  olderThan,
};
