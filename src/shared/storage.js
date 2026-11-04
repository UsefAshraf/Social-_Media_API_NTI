const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { logger } = require('./utils/logger');

const UPLOAD_PREFIX = '/uploads/';

const useCloudinary = () => process.env.STORAGE_DRIVER === 'cloudinary';

// Make a processed file in uploads/ public and return its URL
const publish = async (localPath) => {
  if (!useCloudinary()) return UPLOAD_PREFIX + path.basename(localPath);

  // the SDK reads credentials from CLOUDINARY_URL
  const { secure_url: url } = await cloudinary.uploader.upload(localPath, {
    folder: process.env.CLOUDINARY_FOLDER || 'social-media-api',
    public_id: path.parse(localPath).name,
    resource_type: 'image',
  });
  await fs.promises.unlink(localPath).catch(() => {});
  return url;
};

const isCloudinaryUrl = (url) => /^https:\/\/res\.cloudinary\.com\//.test(url || '');

// https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<name>.webp -> <folder>/<name>
const publicIdFromUrl = (url) => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return match ? match[1] : null;
};

const removeRemote = async (url) => {
  const publicId = publicIdFromUrl(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error({ err: error, url }, 'Failed to delete Cloudinary image');
  }
};

module.exports = {
  useCloudinary,
  publish,
  isCloudinaryUrl,
  publicIdFromUrl,
  removeRemote,
};
