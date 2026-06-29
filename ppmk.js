/**
 * PPM Kollen — shared page utilities
 *
 * Provides theme switching, disclaimer banner, language toggle,
 * and common helpers. Loaded after i18n.js on all pages.
 *
 * Usage:
 *   <script src="i18n.js"></script>
 *   <script src="ppmk.js"></script>
 *   <script>
 *     ppmk.onReady(function(t, lang) {
 *       // page-specific init
 *     });
 *   </script>
 */
(function () {
  "use strict";

  var THEME_KEY = "ppm-kollen-theme";
  var DISCLAIMER_KEY = "ppm-kollen-disclaimer-dismissed";

  // ── Theme switcher ───────────────────────────────────────────
  function initTheme() {
    var saved = "auto";
    try { saved = localStorage.getItem(THEME_KEY) || "auto"; } catch (e) {}
    if (["dark", "light", "auto"].indexOf(saved) === -1) saved = "auto";
    applyTheme(saved);
    document.querySelectorAll(".theme-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { applyTheme(btn.dataset.theme); });
    });
  }

  function applyTheme(mode) {
    document.body.setAttribute("data-theme", mode);
    document.querySelectorAll(".theme-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.theme === mode);
    });
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  }

  // ── Disclaimer banner ────────────────────────────────────────
  function initDisclaimer() {
    var banner = document.getElementById("disclaimer-banner");
    var closeBtn = document.getElementById("disclaimer-banner-close");
    if (!banner) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem(DISCLAIMER_KEY) === "1"; } catch (e) {}
    if (dismissed) { banner.classList.add("dismissed"); return; }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        banner.classList.add("dismissed");
        try { localStorage.setItem(DISCLAIMER_KEY, "1"); } catch (e) {}
      });
    }
  }

  function updateDisclaimerText() {
    var textEl = document.getElementById("disclaimer-banner-text");
    var closeBtn = document.getElementById("disclaimer-banner-close");
    if (textEl && typeof ppmI18n !== "undefined") textEl.innerHTML = ppmI18n.t("disclaimer_text");
    if (closeBtn && typeof ppmI18n !== "undefined") closeBtn.setAttribute("aria-label", ppmI18n.t("disclaimer_close"));
  }

  // ── Language toggle ──────────────────────────────────────────
  function initLangToggle(buttonId) {
    var btn = document.getElementById(buttonId || "lang-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (typeof ppmI18n !== "undefined") {
        ppmI18n.setLang(ppmI18n.getLang() === "sv" ? "en" : "sv");
      }
    });
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;
    document.body.classList.toggle("lang-en", lang === "en");
    var lbl = document.getElementById("lang-label");
    if (lbl && typeof ppmI18n !== "undefined") lbl.textContent = ppmI18n.t("lang_toggle");
  }

  // ── Common helpers ───────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── Ready hook ───────────────────────────────────────────────
  var _themeInit = false;
  var _disclaimerInit = false;
  var _langToggleInit = false;
  var _readyCbs = [];
  var _firedLang = null;

  function onReady(cb) {
    _readyCbs.push(cb);
    if (_firedLang !== null) {
      cb(function (k) { return ppmI18n ? ppmI18n.t(k) : k; }, _firedLang);
    }
  }

  function _fireReady(t, lang) {
    _firedLang = lang;
    for (var i = 0; i < _readyCbs.length; i++) {
      _readyCbs[i](t, lang);
    }
  }

  // Wire everything up via ppmI18n.ready
  if (typeof ppmI18n !== "undefined") {
    ppmI18n.ready(function (t, lang) {
      if (!_themeInit) { _themeInit = true; initTheme(); }
      if (!_disclaimerInit) { _disclaimerInit = true; initDisclaimer(); }
      if (!_langToggleInit) { _langToggleInit = true; initLangToggle(); }
      updateDisclaimerText();
      applyLang(lang);
      _fireReady(t, lang);
    });
  } else {
    // Fallback if i18n.js not loaded
    document.addEventListener("DOMContentLoaded", function () {
      initTheme();
      initDisclaimer();
      _fireReady(function (k) { return k; }, "sv");
    });
  }

  // ── Public API ─────────────────────────────────────────────
  window.ppmk = {
    onReady: onReady,
    esc: esc,
    applyTheme: applyTheme,
    updateDisclaimerText: updateDisclaimerText,
    initLangToggle: initLangToggle,
  };
})();
