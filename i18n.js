/**
 * PPM Kollen — shared i18n loader
 *
 * Usage:
 *   <script src="i18n.js"></script>
 *   <script>
 *     ppmI18n.ready(function (t, lang) {
 *       // t("key") returns translated string
 *       // lang is "sv" or "en"
 *       renderPage();
 *     });
 *   </script>
 *
 * Shows a branded loader overlay until i18n.json is fetched and the
 * callback fires. The loader uses the PPM Kollen logo with a fill
 * animation on the chart arrow.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ppm-kollen-lang";
  var DEFAULT_LANG = "sv";
  var _translations = null;
  var _lang = DEFAULT_LANG;
  var _readyCallbacks = [];

  // ── Inject loader overlay ──────────────────────────────────
  var loader = document.createElement("div");
  loader.id = "ppmk-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", "Loading");
  loader.innerHTML =
    '<div class="ppmk-loader-inner">' +
      '<svg class="ppmk-loader-logo" viewBox="0 0 24 24" width="48" height="48">' +
        '<rect width="24" height="24" rx="5" fill="var(--bg-card, #242940)" />' +
        '<path class="ppmk-loader-arrow" d="M3 19 L9 12 L13 16 L21 6"' +
          ' fill="none" stroke="var(--border, #3a3f55)" stroke-width="2"' +
          ' stroke-linecap="round" stroke-linejoin="round" />' +
        '<path class="ppmk-loader-arrow-fill" d="M3 19 L9 12 L13 16 L21 6"' +
          ' fill="none" stroke="var(--accent, #99ccee)" stroke-width="2"' +
          ' stroke-linecap="round" stroke-linejoin="round" />' +
        '<circle cx="21" cy="6" r="1.6" fill="var(--accent, #99ccee)" class="ppmk-loader-dot" />' +
      '</svg>' +
    '</div>';

  var style = document.createElement("style");
  style.textContent =
    "#ppmk-loader {" +
      "position:fixed;inset:0;z-index:9999;" +
      "background:var(--bg, #1a1f2e);" +
      "display:flex;align-items:center;justify-content:center;" +
      "transition:opacity .3s ease;" +
    "}" +
    "#ppmk-loader.fade-out { opacity:0; pointer-events:none; }" +
    ".ppmk-loader-inner { display:flex;flex-direction:column;align-items:center;gap:12px; }" +
    ".ppmk-loader-logo { filter:drop-shadow(0 0 12px rgba(150,200,240,0.15)); }" +
    ".ppmk-loader-arrow { opacity:0.3; }" +
    ".ppmk-loader-arrow-fill {" +
      "stroke-dasharray:40;" +
      "stroke-dashoffset:40;" +
      "animation:ppmk-draw 1.2s ease-in-out infinite alternate;" +
    "}" +
    ".ppmk-loader-dot { opacity:0; animation:ppmk-dot 1.2s ease-in-out infinite alternate; }" +
    "@keyframes ppmk-draw { from{stroke-dashoffset:40} to{stroke-dashoffset:0} }" +
    "@keyframes ppmk-dot { 0%,60%{opacity:0} 100%{opacity:1} }";

  // Insert before body renders
  document.head.appendChild(style);
  if (document.body) {
    document.body.prepend(loader);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.prepend(loader);
    });
  }

  function hideLoader() {
    var el = document.getElementById("ppmk-loader");
    if (!el) return;
    el.classList.add("fade-out");
    setTimeout(function () { el.remove(); }, 350);
  }

  // ── Core API ───────────────────────────────────────────────
  function t(key) {
    if (!_translations) return key;
    return (_translations[_lang] || _translations[DEFAULT_LANG] || {})[key] || key;
  }

  function getLang() { return _lang; }

  function setLang(lang) {
    if (!_translations || !_translations[lang]) return;
    _lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* noop */ }
    document.documentElement.lang = lang;
    // Fire callbacks again so pages re-render
    for (var i = 0; i < _readyCallbacks.length; i++) {
      _readyCallbacks[i](t, _lang);
    }
  }

  function ready(cb) {
    _readyCallbacks.push(cb);
    if (_translations) cb(t, _lang);
  }

  // ── Load translations ──────────────────────────────────────
  function init() {
    try { _lang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG; } catch (e) { /* noop */ }
    if (_lang !== "sv" && _lang !== "en") _lang = DEFAULT_LANG;
    document.documentElement.lang = _lang;

    fetch("i18n.json")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        _translations = data;
        for (var i = 0; i < _readyCallbacks.length; i++) {
          _readyCallbacks[i](t, _lang);
        }
        hideLoader();
      })
      .catch(function () {
        // Fallback: continue without translations (keys shown as-is)
        _translations = {};
        for (var i = 0; i < _readyCallbacks.length; i++) {
          _readyCallbacks[i](t, _lang);
        }
        hideLoader();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Public API ─────────────────────────────────────────────
  window.ppmI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    ready: ready,
  };
})();
