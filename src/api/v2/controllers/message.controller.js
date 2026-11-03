const User = require('../../../shared/models/User');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const messageService = require('../services/message.service');

const roomWith = async (req) => {
  const other = await User.findById(req.params.userId).select('_id');
  if (!other) {
    throw new ApiError(404, 'User not found');
  }
  return messageService.createRoom(req.user._id.toString(), other._id.toString());
};

const getConversations = asyncHandler(async (req, res) => {
  const conversations = await messageService.getConversations(req.user._id);

  res.status(200).json({
    success: true,
    data: conversations,
  });
});

const getMessages = asyncHandler(async (req, res) => {
  const room = await roomWith(req);
  const { before, limit } = req.query;

  const messages = await messageService.getMessages(room, { before, limit });

  res.status(200).json({
    success: true,
    data: messages,
    // pass this as ?before= to load the previous page
    nextCursor: messages.length ? messages[messages.length - 1].createdAt : null,
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const room = await roomWith(req);
  const updated = await messageService.markAsRead(room, req.user._id);

  res.status(200).json({
    success: true,
    data: { updated },
  });
});

module.exports = {
  getConversations,
  getMessages,
  markAsRead,
};
