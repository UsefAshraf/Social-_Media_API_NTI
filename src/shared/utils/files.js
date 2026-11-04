const fs = require("fs");
const path = require("path");
const { uploadDir } = require("../config/multerConfig");
const { logger } = require("./logger");
const { isCloudinaryUrl, removeRemote } = require("../storage");

const UPLOAD_PREFIX = "/uploads/";

// Public URL path for a file saved by multer
const fileUrl = (file) => (file ? UPLOAD_PREFIX + file.filename : undefined);

// Remove a previously uploaded file (local or Cloudinary); ignores other URLs and missing files
const removeUpload = async (url) => {
  if (isCloudinaryUrl(url)) return removeRemote(url);
  if (!url || !url.startsWith(UPLOAD_PREFIX)) return;

  const filename = path.basename(url);
  try {
    await fs.promises.unlink(path.join(uploadDir, filename));
  } catch (error) {
    if (error.code !== "ENOENT") logger.error({ err: error, url }, "Failed to remove upload");
  }
};

module.exports = {
  fileUrl,
  removeUpload,
};
