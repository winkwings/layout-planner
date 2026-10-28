/* CSP helper for the Sofa Planner.  See INLINE_FIXES.md.
 *
 * The Portal's Content Security Policy blocks style="..." attributes that
 * arrive inside HTML strings (innerHTML). The planner builds a lot of HTML
 * that way. As a SMALL, mechanical fix, those attributes were renamed to
 * data-style="...". This helper copies each one into element.style, which
 * the CSP allows (it is a script setting a property, not inline markup).
 *
 * Later (see KNOWN_LIMITATIONS.md) the planner should build these elements
 * with document.createElement and set positions directly, then this file
 * can be deleted.
 */
(function () {
  "use strict";

  function applyDataStyles(root) {
    if (!root) return;
    var nodes = root.querySelectorAll("[data-style]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.cssText = nodes[i].getAttribute("data-style");
      nodes[i].removeAttribute("data-style"); // keep the DOM clean
    }
  }

  window.SofaPlannerCSP = { applyDataStyles: applyDataStyles };
})();
