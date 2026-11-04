const nodemailer = require("nodemailer")
const { createTransporter } = require("../../../shared/config/nodemailerConfig")
const { welcomeEmailTemplate, passwordResetEmail, verifyEmailTemplate } = require("../../../shared/utils/emailTemplates")
const { getQueue } = require("../../../shared/queue/queues")
const { log, logger } = require("../../../shared/utils/logger")

// Send through SMTP now; throws on failure so queued jobs can retry
const deliverEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL || !process.env.PASSWORD) {
    logger.warn({ subject }, "EMAIL/PASSWORD not set, skipping email")
    return null
  }
  const transporter = createTransporter()
  const info = await transporter.sendMail({
    from: {
      name: "Social Media Api",
      address: process.env.EMAIL
    },
    to,
    subject,
    html
  })
  log(`email sent: ${subject}`)
  return info
}

// Queue the email when Redis is available, otherwise send it now.
// Never throws: a failed email must not fail the request that triggered it.
const sendEmail = async (to, subject, html) => {
  try {
    const queue = getQueue("email")
    if (queue) {
      return await queue.add("send", { to, subject, html }, {
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      })
    }
    return await deliverEmail({ to, subject, html })
  } catch (error) {
    logger.error({ err: error, subject }, "error sending email")
    return null
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

const sendVerificationEmail = async (email, username, token) => {
  const subject = "Verify your email"
  const html = verifyEmailTemplate(username, token)
  return sendEmail(email, subject, html)
}

module.exports = {
  deliverEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendResetEmail
}