const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Post = require('../../../shared/models/Post');
const User = require('../../../shared/models/User');
const { uploadDir } = require('../../../shared/config/multerConfig');
const { removeUpload } = require('../../../shared/utils/files');
const { getQueue } = require('../../../shared/queue/queues');

// don't keep input files open (they are deleted right after, which Windows refuses otherwise)
sharp.cache(false);

const toUrl = (file) => `/uploads/${file}`;

// Output files and the field updates for each kind of upload
const variants = {
  post: async (input, name) => {
    const image = `${name}.webp`;
    const thumbnail = `${name}-thumb.webp`;
    await sharp(input).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(uploadDir, image));
    await sharp(input).rotate().resize(320, 320, { fit: 'cover' }).webp({ quality: 70 }).toFile(path.join(uploadDir, thumbnail));
    return { files: [image, thumbnail], updates: { image: toUrl(image), thumbnail: toUrl(thumbnail) } };
  },
  avatar: async (input, name) => {
    const avatar = `${name}.webp`;
    await sharp(input).rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(uploadDir, avatar));
    return { files: [avatar], updates: { avatar: toUrl(avatar) } };
  },
};

const models = {
  post: { model: Post, field: 'image' },
  avatar: { model: User, field: 'avatar' },
};

// Convert one upload and point its document at the new files.
// Returns the applied updates, or null if the document changed meanwhile.
const processImage = async ({ kind, id, url }) => {
  const input = path.join(uploadDir, path.basename(url));
  if (!fs.existsSync(input)) return null;

  const { files, updates } = await variants[kind](input, path.parse(input).name);

  // only swap if the document still uses this upload (it may have been edited or deleted)
  const { model, field } = models[kind];
  const { matchedCount } = await model.updateOne({ _id: id, [field]: url }, updates);

  if (!matchedCount) {
    await Promise.all(files.map((file) => removeUpload(toUrl(file))));
    return null;
  }

  await removeUpload(url);
  return updates;
};

// Process now, or hand off to the images queue when Redis is available.
// Returns the updates when processed inline, null when queued.
const handleUpload = async (kind, doc, url) => {
  const job = { kind, id: doc._id.toString(), url };
  const queue = getQueue('images');

  if (queue) {
    await queue.add('process', job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000 });
    return null;
  }
  return processImage(job);
};

module.exports = {
  processImage,
  handleUpload,
};
