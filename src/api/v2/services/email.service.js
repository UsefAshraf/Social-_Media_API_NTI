const nodemailer = require("nodemailer")
const { createTransporter } = require("../../../shared/config/nodemailerConfig")
const { welcomeEmailTemplate, passwordResetEmail } = require("../../../shared/utils/emailTemplates")

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter()
    const mailOptions = {
      from: {
        name: "Social Media Api",
        address: process.env.EMAIL
      },
      to,
      subject,
      html
    }
    const info = await transporter.sendMail(mailOptions)
    console.log("email sent")
    return info
  } catch (error) {
    console.error("error sending email", error)
    // throw error
  }
}

const sendWelcomeEmail = async (username, email) => {
  const subject = "welcome to my app"
  const html = welcomeEmailTemplate(username)
  return sendEmail(email, subject, html)

}
const sendResetEmail = async (email, username, resetToken) => {
  const subject = "Reset password"
  const html = passwordResetEmail(username, resetToken)
  return sendEmail(email, subject, html)

}

module.exports = {
  // sendEmail,
  sendWelcomeEmail,
  sendResetEmail
}