// Landing pages for the links in password reset and verification emails.
// They try to open the mobile app and fall back to a small web form.
const path = require('path');
const express = require('express');

const TOKEN_RE = /^[0-9a-f]{64}$/i;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*$/i;
const ASSET_PATH = '/deeplink';

const appScheme = () => {
  const scheme = process.env.APP_SCHEME || 'socialapp';
  return SCHEME_RE.test(scheme) ? scheme : 'socialapp';
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Stricter than the global Helmet policy: no inline code at all, same-origin fetch only
const pageCsp = () =>
  [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    // breaks plain-http LAN testing from a phone, so only in production
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

const setPageHeaders = (res) => {
  res.set({
    'Content-Security-Policy': pageCsp(),
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow',
  });
};

const layout = ({ title, body, script }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${ASSET_PATH}/deeplink.css">
</head>
<body>
  <main class="card">
${body}
  </main>
${script ? `  <script src="${ASSET_PATH}/common.js" defer></script>\n  <script src="${ASSET_PATH}/${script}" defer></script>\n` : ''}</body>
</html>
`;

const errorBody = (heading, message) => `    <h1>${escapeHtml(heading)}</h1>
    <p class="status error" role="alert">${escapeHtml(message)}</p>`;

const openAppBlock = (appUrl) => `    <a class="button" id="open-app" href="${escapeHtml(appUrl)}">Open in app</a>
    <p class="muted">Don't have the app installed? Continue below.</p>`;

const pages = {
  'reset-password': {
    title: 'Reset password',
    script: 'reset.js',
    invalid: 'This password reset link is invalid. Request a new one from the app.',
    body: (token, appUrl) => `    <h1>Reset your password</h1>
${openAppBlock(appUrl)}
    <form id="reset-form" method="post" data-token="${escapeHtml(token)}" novalidate>
      <label for="new-password">New password</label>
      <input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="6" required>
      <label for="confirm-password">Confirm password</label>
      <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required>
      <button type="submit" disabled>Set new password</button>
    </form>
    <p id="status" class="status" role="status" aria-live="polite"></p>`,
  },
  'verify-email': {
    title: 'Verify email',
    script: 'verify.js',
    invalid: 'This verification link is invalid. Request a new one from the app.',
    body: (token, appUrl) => `    <h1>Verify your email</h1>
${openAppBlock(appUrl)}
    <button type="button" id="verify-button" data-token="${escapeHtml(token)}" disabled>Verify email</button>
    <p id="status" class="status" role="status" aria-live="polite"></p>`,
  },
};

const renderPage = (name) => (req, res) => {
  const page = pages[name];
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  setPageHeaders(res);

  // only a validated hex token is ever written into the page
  if (!TOKEN_RE.test(token)) {
    return res.status(400).type('html').send(layout({ title: page.title, body: errorBody('Invalid link', page.invalid) }));
  }

  const normalized = token.toLowerCase();
  const appUrl = `${appScheme()}://${name}?token=${normalized}`;
  return res.status(200).type('html').send(layout({ title: page.title, body: page.body(normalized, appUrl), script: page.script }));
};

const mountDeepLinkPages = (app) => {
  app.use(ASSET_PATH, express.static(path.join(__dirname, 'public'), { index: false, maxAge: '1h' }));
  app.get('/reset-password', renderPage('reset-password'));
  app.get('/verify-email', renderPage('verify-email'));
};

module.exports = { mountDeepLinkPages, TOKEN_RE };
