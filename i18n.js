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

  function hideLoader() {}

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
      try { _readyCallbacks[i](t, _lang); } catch (e) { console.error("i18n setLang callback error:", e); }
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
          try { _readyCallbacks[i](t, _lang); } catch (e) { console.error("i18n ready callback error:", e); }
        }
        hideLoader();
      })
      .catch(function () {
        _translations = {};
        for (var i = 0; i < _readyCallbacks.length; i++) {
          try { _readyCallbacks[i](t, _lang); } catch (e) { console.error("i18n ready callback error:", e); }
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
