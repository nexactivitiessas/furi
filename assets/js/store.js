/**
 * Estado del lado del cliente: carrito (localStorage), sesión de cliente,
 * helpers de formato. NADA de esto toca el backend hasta el checkout.
 */
(function (F) {
  'use strict';

  var CART_KEY = 'furi_cart_v1';
  var CLI_KEY  = 'furi_cliente_v1';
  var ENVIO_KEY = 'furi_envio_v1';

  function readJSON(k, def) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  // ------------------------------------------------------------------ Carrito
  var Cart = {
    items: function () { return readJSON(CART_KEY, []); },

    save: function (items) {
      writeJSON(CART_KEY, items);
      document.dispatchEvent(new CustomEvent('furi:cart-changed'));
    },

    count: function () {
      return this.items().reduce(function (s, i) { return s + Number(i.cantidad || 0); }, 0);
    },

    /**
     * item: { productoId, varianteId, cantidad, nombre, slug, precio,
     *         precioTransferencia, imagen, color, talle, pesoKg, envioGratis }
     */
    add: function (item) {
      var items = this.items();
      var found = items.find(function (i) {
        return String(i.productoId) === String(item.productoId) &&
               String(i.varianteId || '') === String(item.varianteId || '');
      });
      if (found) found.cantidad = Number(found.cantidad) + Number(item.cantidad || 1);
      else items.push(Object.assign({ cantidad: 1 }, item));
      this.save(items);
    },

    setQty: function (idx, qty) {
      var items = this.items();
      if (!items[idx]) return;
      items[idx].cantidad = Math.max(1, Number(qty) || 1);
      this.save(items);
    },

    remove: function (idx) {
      var items = this.items();
      items.splice(idx, 1);
      this.save(items);
    },

    clear: function () { this.save([]); },

    totalUnidades: function () {
      return this.items().reduce(function (s, i) { return s + Number(i.cantidad || 0); }, 0);
    },

    /** ¿Esta línea del carrito debe cobrarse a precio mayorista? (regla combinada) */
    esMayorista: function (item) {
      if (!(Number(item.precioMayorista) > 0)) return false;
      var umbralProd = Number(item.umbralMayorista) || 0;
      var umbralGlobal = Number((F.cfg || {}).CantidadMayoristaDefault) || 0;
      var porLinea = umbralProd > 0 && Number(item.cantidad) >= umbralProd;
      var porCarrito = umbralGlobal > 0 && this.totalUnidades() >= umbralGlobal;
      return porLinea || porCarrito;
    },

    /** Precio unitario efectivo de una línea (minorista o mayorista). */
    precioUnit: function (item) {
      return this.esMayorista(item) ? Number(item.precioMayorista) : Number(item.precio || 0);
    },
    precioUnitTransferencia: function (item) {
      return this.esMayorista(item)
        ? Number(item.precioMayoristaTransferencia || item.precioMayorista)
        : Number(item.precioTransferencia || item.precio || 0);
    },

    hayMayorista: function () {
      var self = this;
      return this.items().some(function (i) { return self.esMayorista(i); });
    },

    subtotal: function () {
      var self = this;
      return this.items().reduce(function (s, i) {
        return s + self.precioUnit(i) * Number(i.cantidad || 0);
      }, 0);
    },

    subtotalTransferencia: function () {
      var self = this;
      return this.items().reduce(function (s, i) {
        return s + self.precioUnitTransferencia(i) * Number(i.cantidad || 0);
      }, 0);
    },

    pesoTotal: function () {
      return this.items().reduce(function (s, i) {
        return s + (Number(i.pesoKg) || 1) * Number(i.cantidad || 0);
      }, 0);
    },

    /** Todo el carrito califica para envío gratis */
    todoEnvioGratis: function () {
      var items = this.items();
      return items.length > 0 && items.every(function (i) { return !!i.envioGratis; });
    }
  };

  // ---------------------------------------------------------- Método de envío
  var Envio = {
    get: function () { return readJSON(ENVIO_KEY, null); },
    set: function (v) { writeJSON(ENVIO_KEY, v); document.dispatchEvent(new CustomEvent('furi:cart-changed')); },
    clear: function () { localStorage.removeItem(ENVIO_KEY); }
  };

  // ---------------------------------------------------------------- Sesión
  var Session = {
    get:     function () { return readJSON(CLI_KEY, null); },
    set:     function (v) { writeJSON(CLI_KEY, v); document.dispatchEvent(new CustomEvent('furi:session-changed')); },
    clear:   function () { localStorage.removeItem(CLI_KEY); document.dispatchEvent(new CustomEvent('furi:session-changed')); },
    token:   function () { var s = this.get(); return s && s.token; },
    cliente: function () { var s = this.get(); return s && s.cliente; },
    logueado:function () { return !!this.token(); }
  };

  // ---------------------------------------------------------------- Formato
  function money(n) {
    var sim = (F.cfg && F.cfg.MonedaSimbolo) || '$';
    var neg = Number(n) < 0;
    var val = Math.abs(Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2).split('.');
    var ent = val[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '- ' : '') + sim + ' ' + ent + ',' + val[1];
  }

  function qs(name, url) {
    var p = new URLSearchParams(url || window.location.search);
    return p.get(name);
  }

  var PLACEHOLDER_IMG =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#eef0f3"/>' +
      '<path d="M120 250l45-55 35 42 30-35 50 63H120z" fill="#c7ccd6"/>' +
      '<circle cx="160" cy="150" r="24" fill="#c7ccd6"/></svg>');

  function img(url) { return url && String(url).trim() ? url : PLACEHOLDER_IMG; }

  F.Cart = Cart;
  F.Envio = Envio;
  F.Session = Session;
  F.money = money;
  F.qs = qs;
  F.img = img;
  F.PLACEHOLDER_IMG = PLACEHOLDER_IMG;
})(window.FURI = window.FURI || {});
