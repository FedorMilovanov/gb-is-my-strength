/* nagornaya-bar-extras.js — inserts Play/Save controls into the real
 * #bottomBar (built by nagornaya-mobile-toc.js) on chapter pages that have
 * a desktop sidebar [data-fc-root] cluster (chast-1..5). Clones the SAME
 * ember/save cluster that floating-cluster-controller.js's own
 * ensureMobileFallbackControls() would otherwise clone into a floating pill
 * — reused here to fill out the real bar instead, so the pill's fallback
 * check (hasVisibleEmber()) naturally skips creating a second, competing
 * control cluster. Theme AND font-size are dropped from the clone: the bar
 * already has its own #barThemeBtn, and the bar has no room left for a
 * fourth+fifth control on a 390px screen (7 fixed icons already fill it —
 * adding font too squeezed "Сейчас читаете" into a vertical letter-stack).
 * Font size stays a desktop-sidebar-only control for now.
 *
 * Must run AFTER nagornaya-mobile-toc.js (so #bottomBar exists) and BEFORE
 * floating-cluster-controller.js (so its DOMContentLoaded scan finds the
 * cloned .gb-ember/.gb-save at their new location) — script order in the
 * page <head>/<body> controls this for deferred scripts.
 */
(function () {
  function run() {
    // Visibility belongs to floating-cluster.css in the components layer.
    // Inline important display overrides also win during PDF printing.
    // Initialize before controller binding on either viewport; CSS hides
    // the mobile cluster on desktop, including after a screen resize.

    var barInner = document.querySelector('#bottomBar .bottom-bar-inner');
    var sidebarControls = document.querySelector('.nag-sidebar-controls[data-fc-root]');
    if (!barInner || !sidebarControls) return;
    if (barInner.querySelector('.nag-bar-controls')) return;

    var clone = sidebarControls.cloneNode(true);
    var themeBtn = clone.querySelector('.nag-sidebar-theme-btn');
    if (themeBtn) themeBtn.remove();
    var fontBtns = clone.querySelector('.nag-fontsize-btns');
    if (fontBtns) fontBtns.remove();
    Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (el) {
      el.removeAttribute('id');
    });
    clone.classList.add('nag-bar-controls');

    var shareBtn = barInner.querySelector('#barShareBtn');
    barInner.insertBefore(clone, shareBtn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
