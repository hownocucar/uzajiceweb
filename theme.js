/*!
 * theme.js – Pizzerie U Zajíce
 * Správa světlého/tmavého režimu s plynulým přechodem a persistencí.
 * Počáteční téma se aplikuje už v <head> (inline skript) – zde jen obsluha přepínače.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'uzajice-theme';
  var ANIM_CLASS = 'theme-animating';
  var ANIM_DURATION = 480; // ms – mírně nad délkou transition v CSS

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStoredTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  function applyTheme(theme, animate) {
    var html = document.documentElement;
    if (animate) {
      html.classList.add(ANIM_CLASS);
      // Po dokončení přechodu třídu odebereme, aby se nadále nepřepočítávaly transition.
      setTimeout(function () { html.classList.remove(ANIM_CLASS); }, ANIM_DURATION);
    }
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
    // Synchronizuj meta theme-color
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#1A1614' : '#B5342B');
    }
    // Aria-label na přepínači
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim');
      btn.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    });
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    applyTheme(next, true);
  }

  // Inicializace přepínačů
  function initToggles() {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', toggleTheme);
      // Klávesová obsluha
      btn.setAttribute('role', 'switch');
      btn.setAttribute('tabindex', '0');
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleTheme();
        }
      });
    });
  }

  // Reaguj na změnu systémové preference, ale pouze pokud uživatel nepotvrdil vlastní volbu.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (getStoredTheme()) return; // uživatel si zvolil vlastní
      applyTheme(e.matches ? 'dark' : 'light', true);
    });
  }

  // Po načtení DOMu inicializuj přepínače a nastav správné aria atributy.
  function init() {
    initToggles();
    // Synchronizuj aria atributy a meta theme-color s aktuálním tématem (bez animace).
    applyTheme(getCurrentTheme(), false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Veřejné API
  window.UZajiceTheme = {
    toggle: toggleTheme,
    apply: applyTheme,
    current: getCurrentTheme
  };
})();
