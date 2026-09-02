/**
 * Cliente HTTP de la API (Apps Script Web App).
 * - GET  -> lecturas públicas (?action=...)
 * - POST -> body como text/plain (evita el preflight CORS de application/json;
 *           el backend hace JSON.parse igual).
 */
(function (F) {
  'use strict';

  function apiUrl() {
    // Override para pruebas/staging: ?api=... (se recuerda) o localStorage.furi_api
    try {
      var qp = new URLSearchParams(location.search).get('api');
      if (qp) localStorage.setItem('furi_api', qp);
      var ov = localStorage.getItem('furi_api');
      if (ov) return ov;
    } catch (e) {}
    var u = F.config && F.config.API_URL;
    if (!u || u.indexOf('PEGAR_TU_DEPLOYMENT_ID') !== -1) {
      console.error('[Furi] Configurá API_URL en assets/js/config.js');
    }
    return u;
  }

  function buildQuery(base, action, params) {
    var u = new URL(base);
    u.searchParams.set('action', action);
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) {
        v.forEach(function (x) { if (x !== '' && x != null) u.searchParams.append(k, x); });
      } else {
        u.searchParams.set(k, v);
      }
    });
    return u.toString();
  }

  async function get(action, params) {
    var r = await fetch(buildQuery(apiUrl(), action, params), { method: 'GET' });
    var j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j.data !== undefined ? j.data : j;
  }

  async function post(action, body) {
    var payload = Object.assign({ action: action }, body || {});
    var r = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    var j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j;
  }

  F.api = { get: get, post: post, apiUrl: apiUrl };
})(window.FURI = window.FURI || {});
