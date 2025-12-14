const nodemailer = require("nodemailer")

exports.createTransporter = () => {
    console.log("creating transporterrrrrrrrrrrrrrrrr")
    return nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD
        },
    })
}