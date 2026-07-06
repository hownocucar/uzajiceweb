/*!
 * geo.js – Pizzerie U Zajíce
 * Na stránce rozvoz.html automaticky vybere nejbližší provozovnu podle polohy
 * a zvýrazní odpovídající řádek v tabulce obcí.
 *
 * Souřadnice provozoven:
 *  - Lhota Rapotina: 49.4383, 16.5353
 *  - Černá Hora:     49.3928, 16.5828
 */
(function () {
  'use strict';

  if (!window.navigator || !navigator.geolocation) return;

  var STORAGE_KEY = 'uzajice-geo-ok';
  var PROVOZOVNY = {
    'lhota': { name: 'Lhota Rapotina', lat: 49.4383, lon: 16.5353 },
    'cerna-hora': { name: 'Černá Hora', lat: 49.3928, lon: 16.5828 }
  };

  // Haversinova formule – vzdálenost dvou GPS bodů v km.
  function distance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function showToast(msg, opts) {
    opts = opts || {};
    var existing = document.querySelector('.geo-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'geo-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<i class="fa-solid ' + (opts.icon || 'fa-location-dot') + '"></i><span>' + msg + '</span>';
    if (opts.retry) {
      var btn = document.createElement('button');
      btn.className = 'geo-toast__retry';
      btn.textContent = 'Zkusit znovu';
      btn.addEventListener('click', function () {
        toast.remove();
        requestGeo();
      });
      toast.appendChild(btn);
    }
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 350);
    }, opts.duration || 5000);
  }

  function selectTab(key) {
    var tabs = document.querySelectorAll('.delivery-tab');
    var panels = document.querySelectorAll('.delivery-panel');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-delivery') === key);
    });
    panels.forEach(function (p) { p.classList.remove('active'); });
    var panel = document.getElementById('delivery-' + key);
    if (panel) panel.classList.add('active');
  }

  function highlightTownInTable(townName) {
    if (!townName) return;
    var activePanel = document.querySelector('.delivery-panel.active');
    if (!activePanel) return;
    var rows = activePanel.querySelectorAll('.delivery-table tbody tr');
    var found = null;
    var lower = townName.toLowerCase();
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i].querySelector('td');
      if (!cell) continue;
      var cellText = cell.textContent.trim().toLowerCase();
      // Přesná shoda nebo obsahuje (např. "Černá Hora" vs "Újezd u Černé Hory")
      if (cellText === lower || cellText.indexOf(lower) >= 0 || lower.indexOf(cellText) >= 0) {
        if (cellText === lower) { found = rows[i]; break; }
        if (!found) found = rows[i];
      }
    }
    if (found) {
      found.classList.add('geo-match');
      // Plynulé scrollování
      try {
        found.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        found.scrollIntoView();
      }
    }
  }

  function reverseGeocode(lat, lon, callback) {
    // Použijeme Nominatim (OpenStreetMap) – bezplatná reverzní geokódování.
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&accept-language=cs&zoom=10';
    var xhr = new XMLHttpRequest();
    xhr.timeout = 4000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          var addr = data.address || {};
          var town = addr.town || addr.village || addr.municipality || addr.city || addr.county || '';
          callback(town);
          return;
        } catch (e) {}
      }
      callback(null);
    };
    xhr.ontimeout = function () { callback(null); };
    xhr.onerror = function () { callback(null); };
    try { xhr.open('GET', url, true); xhr.send(); } catch (e) { callback(null); }
  }

  function handlePosition(pos) {
    var lat = pos.coords.latitude;
    var lon = pos.coords.longitude;
    var dLhota = distance(lat, lon, PROVOZOVNY['lhota'].lat, PROVOZOVNY['lhota'].lon);
    var dCerna = distance(lat, lon, PROVOZOVNY['cerna-hora'].lat, PROVOZOVNY['cerna-hora'].lon);
    var key = dLhota <= dCerna ? 'lhota' : 'cerna-hora';
    var provozovna = PROVOZOVNY[key];
    selectTab(key);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}

    var distKm = Math.round(Math.min(dLhota, dCerna) * 10) / 10;
    showToast('Podle vaší polohy jsme vybrali provozovnu <strong>' + provozovna.name + '</strong> (vzdálenost cca ' + distKm + ' km).', { icon: 'fa-location-dot' });

    // Reverzní geokódování – zkusíme zvýraznit i konkrétní obec v tabulce.
    reverseGeocode(lat, lon, function (town) {
      if (town) highlightTownInTable(town);
    });
  }

  function handleError(err) {
    var msg = 'Polohu se nepodařilo zjistit. Vyberte provozovnu ručně.';
    if (err && err.code === err.PERMISSION_DENIED) {
      msg = 'Přístup k poloze byl zamítnut. Vyberte provozovnu ručně.';
    } else if (err && err.code === err.TIMEOUT) {
      msg = 'Zjišťování polohy vypršelo. Vyberte provozovnu ručně.';
    }
    showToast(msg, { icon: 'fa-triangle-exclamation', retry: true, duration: 7000 });
  }

  function requestGeo() {
    if (!navigator.geolocation) return;
    showToast('Zjišťuji vaši polohu…', { icon: 'fa-spinner fa-spin', duration: 4000 });
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 600000
    });
  }

  // Spustit automaticky jen jednou za návštěvu (localStorage příznak), aby to uživatele neobtěžovalo.
  function init() {
    var alreadyDone;
    try { alreadyDone = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (alreadyDone) return; // uživatel již v minulosti souhlasil – příště už se neptáme

    // Pohár je nutný, protože getCurrentPosition vyžaduje uživatelskou interakci v některých prohlížečích
    // (např. Safari). Počkáme na první interakci.
    function startOnce() {
      document.removeEventListener('click', startOnce);
      document.removeEventListener('keydown', startOnce);
      requestGeo();
    }
    document.addEventListener('click', startOnce, { once: true });
    document.addEventListener('keydown', startOnce, { once: true });
    // Fallback – pokud nepřijde interakce do 6 s, zkusit rovnou (některé prohlížeče to povolí).
    setTimeout(function () {
      document.removeEventListener('click', startOnce);
      document.removeEventListener('keydown', startOnce);
      requestGeo();
    }, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
