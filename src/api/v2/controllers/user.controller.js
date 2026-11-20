const mongoose = require('mongoose');
const User = require('../../../shared/models/User');
const Post = require('../../../shared/models/Post');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiError = require('../../../shared/utils/ApiError');
const { fileUrl, removeUpload } = require('../../../shared/utils/files');
const { parsePagination, paginationMeta } = require('../../../shared/utils/pagination');
const { notify } = require('../services/notification.service');
const { handleUpload } = require('../services/image.service');
const { hiddenUserIds, isBlockedBetween } = require('../services/block.service');
const { sendVerification } = require('../services/auth.service');

const PROFILE_FIELDS = 'username avatar bio followers following email emailVerified role createdAt';
const SUMMARY_FIELDS = 'username avatar bio';

const includesId = (ids = [], id) => ids.some((x) => x.equals(id));

// Look up a user by a route id; malformed ids are treated as missing
const findUserOr404 = async (id, fields) => {
  const user = mongoose.isValidObjectId(id) ? await User.findById(id).select(fields) : null;
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

// Whitelisted profile JSON; private fields only on the viewer's own profile
const toProfile = async (user, viewer) => {
  const isMe = user._id.equals(viewer._id);
  const followers = user.followers || [];
  const following = user.following || [];

  const profile = {
    _id: user._id,
    username: user.username,
    avatar: user.avatar || '',
    bio: user.bio || '',
    followersCount: followers.length,
    followingCount: following.length,
    postsCount: await Post.countDocuments({ author: user._id }),
    isMe,
    isFollowing: !isMe && includesId(followers, viewer._id),
    followsYou: !isMe && includesId(following, viewer._id),
    createdAt: user.createdAt,
    followers,
    following,
  };

  if (isMe) {
    profile.email = user.email;
    profile.emailVerified = user.emailVerified;
    profile.role = user.role;
  }
  return profile;
};

// One page of users from an id list (already in display order), without loading the rest
const pageOfUsers = async (ids, query, viewer, { canFollow = true } = {}) => {
  const pagination = parsePagination(query, { defaultLimit: 20, max: 50 });
  const pageIds = ids.slice(pagination.skip, pagination.skip + pagination.limit);

  const users = await User.find({ _id: { $in: pageIds } }).select(SUMMARY_FIELDS).lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  const following = viewer.following || [];

  const data = pageIds
    .map((id) => byId.get(id.toString()))
    .filter(Boolean)
    .map((u) => ({
      _id: u._id,
      username: u.username,
      avatar: u.avatar || '',
      bio: u.bio || '',
      isFollowing: canFollow && includesId(following, u._id),
      isMe: u._id.equals(viewer._id),
    }));

  return { count: ids.length, data, pagination: paginationMeta(pagination, ids.length) };
};

// Follower/following counts after a follow change
const followCounts = async (targetId, viewerId) => {
  const [target, viewer] = await Promise.all([
    User.findById(targetId).select('followers').lean(),
    User.findById(viewerId).select('following').lean(),
  ]);
  return {
    followersCount: target?.followers?.length || 0,
    followingCount: viewer?.following?.length || 0,
  };
};

const getProfile = asyncHandler(async (req, res) => {
  const otherUser = Boolean(req.params.id);
  const user = await findUserOr404(req.params.id || req.user._id, PROFILE_FIELDS);

  if (otherUser && !user._id.equals(req.user._id) && (await isBlockedBetween(req.user._id, user._id))) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    data: await toProfile(user, req.user),
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { username, email, bio } = req.body;
  const uploaded = fileUrl(req.file);
  const avatar = uploaded ?? req.body.avatar;
  const me = req.user._id;

  const previous = await User.findById(me).select('avatar email username');

  const updateData = {};
  if (username && username !== previous.username) updateData.username = username;
  if (email && email.trim().toLowerCase() !== previous.email) updateData.email = email.trim().toLowerCase();
  if (bio !== undefined) updateData.bio = bio;
  if (avatar !== undefined) updateData.avatar = avatar;

  if (updateData.username && (await User.exists({ username: updateData.username, _id: { $ne: me } }))) {
    throw new ApiError(400, 'Username already exists');
  }
  if (updateData.email && (await User.exists({ email: updateData.email, _id: { $ne: me } }))) {
    throw new ApiError(400, 'Email already exists');
  }
  // a new address has to be verified again
  if (updateData.email) updateData.emailVerified = false;

  const user = await User.findByIdAndUpdate(me, updateData, {
    new: true,
    runValidators: true,
  }).select(PROFILE_FIELDS);

  if (avatar !== undefined && previous.avatar !== user.avatar) {
    await removeUpload(previous.avatar);
  }
  if (uploaded) Object.assign(user, await handleUpload('avatar', user, uploaded));
  if (updateData.email) await sendVerification(await User.findById(me));

  res.status(200).json({
    success: true,
    data: await toProfile(user, user),
  });
});

const followUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  if (targetId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  const target = await findUserOr404(targetId, "_id username");

  if (await isBlockedBetween(req.user._id, target._id)) {
    throw new ApiError(403, "You cannot follow this user");
  }

  const { modifiedCount } = await User.updateOne(
    { _id: req.user._id, following: { $ne: target._id } },
    { $addToSet: { following: target._id } }
  );
  await User.updateOne({ _id: target._id }, { $addToSet: { followers: req.user._id } });

  // only notify on a new follow, not a repeated request
  if (modifiedCount) {
    await notify(req.app.get("io"), {
      recipient: target._id,
      sender: req.user._id,
      type: "follow",
      content: `${req.user.username} started following you`,
      link: `/users/${req.user._id}`,
    });
  }

  res.status(200).json({
    success: true,
    message: `You are now following ${target.username}`,
    data: { following: true, ...(await followCounts(target._id, req.user._id)) },
  });
});

const unfollowUser = asyncHandler(async (req, res) => {
  const target = await findUserOr404(req.params.id, "_id username");

  await User.updateOne({ _id: req.user._id }, { $pull: { following: target._id } });
  await User.updateOne({ _id: target._id }, { $pull: { followers: req.user._id } });

  res.status(200).json({
    success: true,
    message: `You unfollowed ${target.username}`,
    data: { following: false, ...(await followCounts(target._id, req.user._id)) },
  });
});

const listConnections = (field) =>
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id, field);
    const viewer = req.user._id;

    if (!user._id.equals(viewer) && (await isBlockedBetween(viewer, user._id))) {
      throw new ApiError(404, "User not found");
    }

    // ids are appended on follow, so reverse for newest first
    const hidden = new Set((await hiddenUserIds(viewer)).map(String));
    const ids = [...user[field]].reverse().filter((id) => !hidden.has(id.toString()));

    res.status(200).json({
      success: true,
      ...(await pageOfUsers(ids, req.query, req.user)),
    });
  });

const getFollowers = listConnections("followers");
const getFollowing = listConnections("following");

const blockUser = asyncHandler(async (req, res) => {
  const me = req.user._id;

  if (req.params.id === me.toString()) {
    throw new ApiError(400, "You cannot block yourself");
  }

  const target = await findUserOr404(req.params.id, "_id username");

  await User.updateOne(
    { _id: me },
    { $addToSet: { blocked: target._id }, $pull: { following: target._id, followers: target._id } }
  );
  await User.updateOne({ _id: target._id }, { $pull: { following: me, followers: me } });

  res.status(200).json({
    success: true,
    message: `You blocked ${target.username}`,
    data: { blocked: true },
  });
});

const unblockUser = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(404, "User not found");
  }
  await User.updateOne({ _id: req.user._id }, { $pull: { blocked: req.params.id } });

  res.status(200).json({
    success: true,
    message: "User unblocked",
    data: { blocked: false },
  });
});

const getBlocked = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user._id).select("+blocked");
  const ids = [...(me.blocked || [])].reverse();

  res.status(200).json({
    success: true,
    ...(await pageOfUsers(ids, req.query, req.user, { canFollow: false })),
  });
});

module.exports = {
  blockUser,
  unblockUser,
  getBlocked,
  getProfile,
  getFollowers,
  getFollowing,
  updateProfile,
  followUser,
  unfollowUser,
};
