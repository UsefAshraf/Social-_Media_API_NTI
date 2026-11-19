// Shared helpers for the reset / verify landing pages (loaded before the page script)
(function () {
  'use strict';

  var statusEl = function () {
    return document.getElementById('status');
  };

  window.deeplink = {
    setStatus: function (text, kind) {
      var el = statusEl();
      if (!el) return;
      el.textContent = text;
      el.className = 'status' + (kind ? ' ' + kind : '');
    },

    // POST JSON to the same-origin API and resolve with { ok, body }
    post: function (url, payload) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(payload),
      }).then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            return { ok: res.ok, status: res.status, body: body };
          });
      });
    },

    // drop the token from the address bar once it has been used
    forgetToken: function () {
      try {
        history.replaceState(null, '', location.pathname);
      } catch (e) {
        /* ignore */
      }
    },

    // try the app once on load; the button stays for a manual retry
    tryOpenApp: function () {
      var link = document.getElementById('open-app');
      if (!link) return;
      try {
        if (sessionStorage.getItem('deeplink-tried') === location.search) return;
        sessionStorage.setItem('deeplink-tried', location.search);
      } catch (e) {
        /* storage unavailable: still try once */
      }
      window.location.href = link.href;
    },
  };
})();
