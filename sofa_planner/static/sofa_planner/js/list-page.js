/* List page: ask before deleting. External file (no inline handlers, CSP rule).
 * The server still checks login, permission and ownership on every delete. */
(function () {
  "use strict";
  document.querySelectorAll("form[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      if (!window.confirm(form.getAttribute("data-confirm"))) e.preventDefault();
    });
  });
})();
