const User = require('../../../shared/models/User');
const { extractMentions } = require('../../../shared/utils/text');
const { notify } = require('./notification.service');

// Users referenced as @username in the text (unknown names are ignored)
const resolveMentions = async (text) => {
  const usernames = extractMentions(text);
  if (!usernames.length) return [];
  return User.find({ username: { $in: usernames } }).select('_id username');
};

const notifyMentions = (io, users, { sender, where, post }) =>
  Promise.all(
    users.map((user) =>
      notify(io, {
        recipient: user._id,
        sender: sender._id,
        type: 'mention',
        content: `${sender.username} mentioned you in a ${where}`,
        link: `/posts/${post._id}`,
        relatedId: post._id,
      })
    )
  );

module.exports = {
  resolveMentions,
  notifyMentions,
};
