const multer = require("multer")
const crypto = require("crypto")
const ApiError = require("../utils/ApiError")
const fs = require("fs")
const path = require("path")

const uploadDir = path.join(__dirname, "..", "..", "..", "uploads")
fs.mkdirSync(uploadDir, { recursive: true })

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // image-2025-11-7.jpg
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        // never trust the client filename; keep only a known extension
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z]/g, "")
        const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`
        cb(null, filename)
    }
})

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new ApiError(400, "Only JPEG and PNG images are allowed"), false)
    }
}

const limits = {
    fileSize: 5 * 1024 * 1024 // 5MB
}

module.exports = {
    uploadDir,
    fileStorage,
    fileFilter,
    limits
}