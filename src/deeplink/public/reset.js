(function () {
  'use strict';

  var dl = window.deeplink;
  var form = document.getElementById('reset-form');
  if (!form) return;

  var token = form.getAttribute('data-token') || '';
  var submit = form.querySelector('button[type="submit"]');
  var password = document.getElementById('new-password');
  var confirm = document.getElementById('confirm-password');

  if (!/^[0-9a-f]{64}$/i.test(token)) {
    dl.setStatus('This password reset link is invalid.', 'error');
    return;
  }

  submit.disabled = false;
  dl.tryOpenApp();

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (password.value.length < 6) {
      dl.setStatus('Password must be at least 6 characters.', 'error');
      return;
    }
    if (password.value !== confirm.value) {
      dl.setStatus('Passwords do not match.', 'error');
      return;
    }

    submit.disabled = true;
    dl.setStatus('Saving…');

    dl.post('/api/v2/auth/reset', { token: token, newPassword: password.value })
      .then(function (res) {
        if (res.ok) {
          form.className = 'hidden';
          dl.forgetToken();
          dl.setStatus('Your password has been reset. You can now log in with the new password.', 'ok');
        } else {
          submit.disabled = false;
          dl.setStatus((res.body && res.body.error) || 'Could not reset the password.', 'error');
        }
      })
      .catch(function () {
        submit.disabled = false;
        dl.setStatus('Network error. Please try again.', 'error');
      });
  });
})();
