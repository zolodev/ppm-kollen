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
  var HOLDINGS_KEY = "ppm-kollen-holdings";

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

  // ── Holdings: which funds the reader actually holds ──────────
  //
  // Stored per year, because that is the unit the reader switches funds in
  // and the unit the price grid is published in (prices_2026.json). A flat
  // list would make "what did I hold in 2025" a date-range scan over an
  // ever-growing array, and would have to be migrated the first time someone
  // wanted last year's summary. Years are independent from the start.
  //
  //   { version: 1, years: { "2026": [ {ppm, from, added}, ... ] } }
  //
  // `from` is the date the switch took effect, which the reader sets and can
  // correct afterwards — PPM switches settle days after they are requested,
  // so the date they remember is rarely the date the money actually moved.
  // Entries are kept sorted by `from`; the holding that `from` opens runs
  // until the next entry's `from`, or until today for the last one.
  //
  // Everything here is per-browser. It is never sent anywhere, so it is also
  // never backed up — the page says so rather than implying a server knows.
  var _holdingsCbs = [];

  function _todayISO() {
    var d = new Date();
    return d.getFullYear() + "-"
      + String(d.getMonth() + 1).padStart(2, "0") + "-"
      + String(d.getDate()).padStart(2, "0");
  }

  function _readStore() {
    var raw = null;
    try { raw = localStorage.getItem(HOLDINGS_KEY); } catch (e) { return { version: 1, years: {} }; }
    if (!raw) return { version: 1, years: {} };
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object" || typeof o.years !== "object" || !o.years) {
        return { version: 1, years: {} };
      }
      return { version: o.version || 1, years: o.years };
    } catch (e) {
      // Corrupt or hand-edited storage: start clean rather than throwing on
      // every page load and leaving the whole site blank.
      return { version: 1, years: {} };
    }
  }

  function _writeStore(store) {
    try { localStorage.setItem(HOLDINGS_KEY, JSON.stringify(store)); } catch (e) {}
    _holdingsCbs.forEach(function (cb) { try { cb(); } catch (e) {} });
    applyHighlights();
  }

  function _normPpm(ppm) {
    return String(ppm == null ? "" : ppm).replace(/\D/g, "");
  }

  function _yearOf(dateISO) {
    return String(dateISO || _todayISO()).slice(0, 4);
  }

  function holdingsYears() {
    var years = Object.keys(_readStore().years).filter(function (y) {
      return (_readStore().years[y] || []).length > 0;
    });
    return years.sort();
  }

  function holdingsGet(year) {
    var list = _readStore().years[String(year || _yearOf())] || [];
    return list.slice().sort(function (a, b) {
      return String(a.from).localeCompare(String(b.from));
    });
  }

  // Every year at once, oldest first — what the summary page charts.
  function holdingsAll() {
    var store = _readStore();
    return Object.keys(store.years).sort().map(function (y) {
      return { year: y, entries: holdingsGet(y) };
    });
  }

  function holdingsAdd(ppm, fromISO) {
    var code = _normPpm(ppm);
    if (!code) return null;
    var from = fromISO || _todayISO();
    var year = _yearOf(from);
    var store = _readStore();
    if (!store.years[year]) store.years[year] = [];
    // Re-entering the same fund on the same date is a double submit, not a
    // second switch — a duplicate would show as a zero-length holding.
    var dup = store.years[year].some(function (e) {
      return e.ppm === code && e.from === from;
    });
    if (dup) return null;
    var entry = { ppm: code, from: from, added: new Date().toISOString() };
    store.years[year].push(entry);
    _writeStore(store);
    return entry;
  }

  function holdingsRemove(year, ppm, fromISO) {
    var store = _readStore();
    var list = store.years[String(year)] || [];
    store.years[String(year)] = list.filter(function (e) {
      return !(e.ppm === _normPpm(ppm) && e.from === fromISO);
    });
    _writeStore(store);
  }

  function holdingsSetDate(year, ppm, oldFrom, newFrom) {
    var store = _readStore();
    var list = store.years[String(year)] || [];
    var moved = null;
    store.years[String(year)] = list.filter(function (e) {
      if (e.ppm === _normPpm(ppm) && e.from === oldFrom) { moved = e; return false; }
      return true;
    });
    if (moved) {
      moved.from = newFrom;
      var y2 = _yearOf(newFrom);
      if (!store.years[y2]) store.years[y2] = [];
      store.years[y2].push(moved);
    }
    _writeStore(store);
  }

  function holdingsClear(year) {
    var store = _readStore();
    if (year == null) store.years = {};
    else delete store.years[String(year)];
    _writeStore(store);
  }

  // The fund held right now: the latest entry whose `from` has already passed.
  // A switch dated in the future is stored but not yet current, so someone can
  // record a pending switch without the site claiming they already own it.
  function holdingsCurrent() {
    var today = _todayISO();
    var current = null;
    holdingsAll().forEach(function (y) {
      y.entries.forEach(function (e) {
        if (String(e.from) <= today) current = e;
      });
    });
    return current;
  }

  // Every code the reader has ever entered — what gets highlighted, so a fund
  // they held earlier in the year still stands out when it reappears in a
  // ranking. The one held today is marked separately.
  function holdingsCodes() {
    var seen = {};
    holdingsAll().forEach(function (y) {
      y.entries.forEach(function (e) { seen[e.ppm] = true; });
    });
    return Object.keys(seen);
  }

  function holdingsOnChange(cb) { if (typeof cb === "function") _holdingsCbs.push(cb); }

  // ── Highlighting held funds, on every page ───────────────────
  //
  // Anchored on [data-ppm] rather than on any one page's markup, so a page
  // opts in by putting the code on the element it wants marked and needs no
  // JS of its own. The card/row around it is marked too, since a ring on a
  // 60px pill inside a 400px card is easy to miss.
  var HOLDING_ANCESTORS = ".fund-card, .ranking-card, tr, .ov-row";

  function applyHighlights() {
    if (typeof document === "undefined") return;
    var codes = {};
    holdingsCodes().forEach(function (c) { codes[c] = true; });
    var cur = holdingsCurrent();
    var curCode = cur ? cur.ppm : null;

    document.querySelectorAll("[data-ppm]").forEach(function (el) {
      var code = _normPpm(el.getAttribute("data-ppm"));
      var held = !!codes[code];
      var isCur = held && code === curCode;
      el.classList.toggle("ppm-held", held);
      el.classList.toggle("ppm-held-current", isCur);
      var box = el.closest(HOLDING_ANCESTORS);
      if (box) {
        box.classList.toggle("ppm-held", held);
        box.classList.toggle("ppm-held-current", isCur);
      }
    });
  }

  // index.html rebuilds its tab panels on every tab click, which drops the
  // classes applied above. Re-apply on DOM changes rather than asking each
  // page to remember to call us back after it renders.
  var _observer = null;
  function watchHighlights() {
    if (_observer || typeof MutationObserver === "undefined") return;
    var pending = false;
    _observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      // Coalesce: a single render can fire hundreds of mutations, and each
      // would otherwise walk the whole document.
      requestAnimationFrame(function () { pending = false; applyHighlights(); });
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Main navigation ──────────────────────────────────────────
  //
  // Rendered here rather than written into each page, because it was not: the
  // six pages had three different header layouts between them, index and
  // validation linked to some siblings, about and help linked back to the
  // front page only, and nothing linked to portfolio.html. Adding a seventh
  // page meant editing six files and missing one. This builds the same menu
  // into whatever .header-right a page already has, so a new entry is one
  // line in NAV_PAGES.
  //
  // dashboard.html is deliberately untouched: it is the ops monitor, loads
  // neither i18n.js nor this file, and its .header-right holds the clock and
  // poll interval. It never reaches this code.
  var NAV_PAGES = [
    { href: "index.html",       key: "nav_forecast" },
    { href: "portfolio.html",   key: "nav_portfolio" },
    { href: "validation.html",  key: "nav_validation" },
    { href: "seasonality.html", key: "nav_seasonality" },
    { href: "help.html",        key: "nav_help" },
    { href: "about.html",       key: "nav_about" },
  ];

  function _t(key, fallback) {
    if (typeof ppmI18n === "undefined") return fallback;
    var v = ppmI18n.t(key);
    return v === key ? fallback : v;
  }

  function _currentPage() {
    var path = (location.pathname || "").split("/").pop();
    return path || "index.html";
  }

  var _navBuilt = false;

  function buildNav() {
    var host = document.querySelector(".header-right");
    if (!host || _navBuilt) return;

    var here = _currentPage();
    var links = NAV_PAGES.map(function (p) {
      var active = p.href === here;
      // aria-current is the accessible "you are here"; the class is only the
      // visual half of the same fact.
      return '<li><a class="nav-link' + (active ? " active" : "") + '" href="'
        + p.href + '"' + (active ? ' aria-current="page"' : "") + ' data-nav-key="'
        + p.key + '">' + esc(_t(p.key, p.href)) + "</a></li>";
    }).join("");

    // The language button and theme switcher live inside the panel, once.
    // Duplicating them for a separate mobile copy would put two #lang-toggle
    // ids in the document and leave initTheme wiring only the first — the
    // panel simply reflows from a header row to a drawer instead.
    host.innerHTML =
      '<nav class="main-nav" id="main-nav" aria-label="' + esc(_t("nav_label", "Huvudmeny")) + '">'
      + '<button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false"'
      + ' aria-controls="nav-panel" aria-label="' + esc(_t("nav_menu", "Meny")) + '">'
      + '<span class="nav-bars" aria-hidden="true"><span></span><span></span><span></span></span>'
      + "</button>"
      + '<div class="nav-panel" id="nav-panel">'
      + '<ul class="nav-list">' + links + "</ul>"
      + '<div class="nav-tools">'
      + '<button class="ghost-btn" id="lang-toggle" type="button" title="Byt språk / Switch language">'
      + '<span id="lang-label">EN</span></button>'
      + '<div class="theme-switcher" role="group" aria-label="' + esc(_t("nav_theme", "Tema")) + '">'
      + _themeBtn("light", "nav_theme_light", "Ljust",
          '<circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></g>')
      + _themeBtn("auto", "nav_theme_auto", "Auto",
          '<path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.4"/>')
      + _themeBtn("dark", "nav_theme_dark", "Mörkt",
          '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor"/>')
      + "</div></div></div></nav>"
      + '<div class="nav-scrim" id="nav-scrim" hidden></div>';

    _navBuilt = true;
    wireNav();
  }

  function _themeBtn(mode, key, fallback, svg) {
    var label = esc(_t(key, fallback));
    return '<button class="theme-btn" data-theme="' + mode + '" type="button" title="'
      + label + '" aria-label="' + label + '">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' + svg + "</svg>"
      + "</button>";
  }

  function wireNav() {
    var toggle = document.getElementById("nav-toggle");
    var panel = document.getElementById("nav-panel");
    var scrim = document.getElementById("nav-scrim");
    if (!toggle || !panel) return;

    function isOpen() { return document.body.classList.contains("nav-open"); }

    function setOpen(open) {
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (scrim) scrim.hidden = !open;
      // The panel is hidden with visibility, not opacity: visibility:hidden
      // also takes its links out of the tab order, so a closed drawer cannot
      // be tabbed into from behind the page.
      if (open) {
        var first = panel.querySelector("a, button");
        if (first) first.focus();
      }
    }

    toggle.addEventListener("click", function () { setOpen(!isOpen()); });
    if (scrim) scrim.addEventListener("click", function () { setOpen(false); toggle.focus(); });

    // Navigating away closes it; so does picking a theme, which otherwise
    // leaves the drawer covering the page the reader just re-themed.
    panel.addEventListener("click", function (ev) {
      if (ev.target.closest("a, .theme-btn")) setOpen(false);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && isOpen()) { setOpen(false); toggle.focus(); }
    });

    // Focus trap, only while the drawer is actually a drawer. On a wide
    // screen the panel is part of the header and trapping would strand the
    // keyboard there.
    panel.addEventListener("keydown", function (ev) {
      if (ev.key !== "Tab" || !isOpen()) return;
      var items = panel.querySelectorAll("a[href], button:not([disabled])");
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
      else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
    });

    // Resizing past the breakpoint with the drawer open would otherwise leave
    // body.nav-open set and the scrim covering a desktop layout.
    if (window.matchMedia) {
      var mq = window.matchMedia("(min-width: 721px)");
      var onChange = function (e) { if (e.matches && isOpen()) setOpen(false); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  // Re-label on language switch. Rebuilding would drop the theme buttons that
  // initTheme already wired, so only the text changes.
  function applyNavLang() {
    document.querySelectorAll("[data-nav-key]").forEach(function (a) {
      a.textContent = _t(a.getAttribute("data-nav-key"), a.textContent);
    });
    var nav = document.getElementById("main-nav");
    if (nav) nav.setAttribute("aria-label", _t("nav_label", "Huvudmeny"));
    var tg = document.getElementById("nav-toggle");
    if (tg) tg.setAttribute("aria-label", _t("nav_menu", "Meny"));
    var sw = document.querySelector(".nav-tools .theme-switcher");
    if (sw) sw.setAttribute("aria-label", _t("nav_theme", "Tema"));
    [["light", "nav_theme_light", "Ljust"], ["auto", "nav_theme_auto", "Auto"],
     ["dark", "nav_theme_dark", "Mörkt"]].forEach(function (spec) {
      var b = document.querySelector('.nav-tools .theme-btn[data-theme="' + spec[0] + '"]');
      if (!b) return;
      b.setAttribute("aria-label", _t(spec[1], spec[2]));
      b.setAttribute("title", _t(spec[1], spec[2]));
    });
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

  function onReady(cb) {
    _readyCbs.push(cb);
    // ppmI18n.ready handles the "already fired" case internally
    if (typeof ppmI18n !== "undefined") {
      ppmI18n.ready(function (t, lang) {
        cb(t, lang);
      });
    }
  }

  // Init shared components once via ppmI18n.ready
  if (typeof ppmI18n !== "undefined") {
    ppmI18n.ready(function (t, lang) {
      // Nav first: it renders the theme buttons and the language toggle, so
      // initTheme/initLangToggle below must find them already in the DOM.
      buildNav();
      applyNavLang();
      if (!_themeInit) { _themeInit = true; initTheme(); }
      if (!_disclaimerInit) { _disclaimerInit = true; initDisclaimer(); }
      if (!_langToggleInit) { _langToggleInit = true; initLangToggle(); }
      updateDisclaimerText();
      applyLang(lang);
      applyHighlights();
      watchHighlights();
    });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      buildNav();
      initTheme();
      initDisclaimer();
      applyHighlights();
      watchHighlights();
    });
  }

  // Another tab switching funds should not leave this one highlighting the
  // old set — the store is shared, so the view should be too.
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("storage", function (ev) {
      if (ev && ev.key && ev.key !== HOLDINGS_KEY) return;
      _holdingsCbs.forEach(function (cb) { try { cb(); } catch (e) {} });
      applyHighlights();
    });
  }

  // ── Public API ─────────────────────────────────────────────
  window.ppmk = {
    onReady: onReady,
    esc: esc,
    applyTheme: applyTheme,
    updateDisclaimerText: updateDisclaimerText,
    initLangToggle: initLangToggle,
    buildNav: buildNav,
    applyNavLang: applyNavLang,
    today: _todayISO,
    holdings: {
      get: holdingsGet,
      all: holdingsAll,
      years: holdingsYears,
      add: holdingsAdd,
      remove: holdingsRemove,
      setDate: holdingsSetDate,
      clear: holdingsClear,
      current: holdingsCurrent,
      codes: holdingsCodes,
      onChange: holdingsOnChange,
      refresh: applyHighlights,
    },
  };
})();
