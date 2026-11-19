(function () {
  'use strict';

  var dl = window.deeplink;
  var button = document.getElementById('verify-button');
  if (!button) return;

  var token = button.getAttribute('data-token') || '';
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    dl.setStatus('This verification link is invalid.', 'error');
    return;
  }

  button.disabled = false;
  dl.tryOpenApp();

  button.addEventListener('click', function () {
    button.disabled = true;
    dl.setStatus('Verifying…');

    dl.post('/api/v2/auth/verify-email', { token: token })
      .then(function (res) {
        if (res.ok) {
          button.className = 'hidden';
          dl.forgetToken();
          dl.setStatus('Your email has been verified.', 'ok');
        } else {
          button.disabled = false;
          dl.setStatus((res.body && res.body.error) || 'Could not verify the email.', 'error');
        }
      })
      .catch(function () {
        button.disabled = false;
        dl.setStatus('Network error. Please try again.', 'error');
      });
  });
})();
