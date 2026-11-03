const fs = require("fs");
const path = require("path");
const { uploadDir } = require("../config/multerConfig");

const UPLOAD_PREFIX = "/uploads/";

// Public URL path for a file saved by multer
const fileUrl = (file) => (file ? UPLOAD_PREFIX + file.filename : undefined);

// Remove a previously uploaded file; ignores external URLs and missing files
const removeUpload = async (url) => {
  if (!url || !url.startsWith(UPLOAD_PREFIX)) return;

  const filename = path.basename(url);
  try {
    await fs.promises.unlink(path.join(uploadDir, filename));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Failed to remove upload", error);
  }
};

module.exports = {
  fileUrl,
  removeUpload,
};
