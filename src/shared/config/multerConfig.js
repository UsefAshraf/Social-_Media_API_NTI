const multer = require("multer")

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // image-2025-11-7.jpg
        cb(null, "uploads")
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