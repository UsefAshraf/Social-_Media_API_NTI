const multer = require("multer")
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
        const filename = `${Date.now()}-${file.originalname}`
        cb(null, filename)
    }
})

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error("Only image file allowed"), false)
    }
}

module.exports = {
    fileStorage,
    fileFilter
}