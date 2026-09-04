/**
 * Chrome compartido: header, nav de categorías, footer, toast, badge del carrito.
 * Todo se arma con datos de la API (getConfiguracion + getCategorias). Nada hardcodeado.
 */
(function (F) {
  'use strict';

  var cfgPromise = null;

  function loadConfig() {
    if (!cfgPromise) {
      cfgPromise = F.api.get('getConfiguracion').then(function (cfg) {
        F.cfg = cfg || {};
        applyTheme(F.cfg);
        return F.cfg;
      }).catch(function (e) {
        console.error('No se pudo cargar la configuración:', e);
        F.cfg = {};
        return F.cfg;
      });
    }
    return cfgPromise;
  }

  function applyTheme(cfg) {
    var r = document.documentElement.style;
    if (cfg.ColorPrimario)   r.setProperty('--c-primario', cfg.ColorPrimario);
    if (cfg.ColorSecundario) r.setProperty('--c-secundario', cfg.ColorSecundario);
    if (cfg.FaviconURL) {
      var link = document.querySelector('link[rel="icon"]') || document.createElement('link');
      link.rel = 'icon'; link.href = cfg.FaviconURL;
      document.head.appendChild(link);
    }
    var base = document.title || 'Tienda';
    document.title = base + ' · ' + (cfg.NombreTienda || 'Tienda Furi');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function categoriasArbol(cats) {
    var raiz = cats.filter(function (c) { return !c.CategoriaPadreID; });
    return raiz.map(function (c) {
      return {
        cat: c,
        hijos: cats.filter(function (h) { return String(h.CategoriaPadreID) === String(c.ID); })
      };
    });
  }

  async function renderChrome() {
    var cfg = await loadConfig();
    var cats = [];
    try { cats = await F.api.get('getCategorias'); } catch (e) {}

    mountHeader(cfg, cats);
    mountFooter(cfg);
    mountWhatsApp(cfg);
    updateCartBadge();
    refreshSessionLink();

    document.addEventListener('furi:cart-changed', updateCartBadge);
    document.addEventListener('furi:session-changed', refreshSessionLink);
  }

  function mountHeader(cfg, cats) {
    var host = document.getElementById('site-header');
    if (!host) return;
    var arbol = categoriasArbol(cats || []);
    var nombre = esc(cfg.NombreTienda || 'Tienda Furi');
    var logo = cfg.LogoURL
      ? '<img src="' + esc(cfg.LogoURL) + '" alt="' + nombre + '">'
      : '<span class="logo-text">' + nombre + '</span>';

    host.innerHTML =
      (cfg.TextoBannerSuperior ? '<div class="topbar">' + esc(cfg.TextoBannerSuperior) + '</div>' : '') +
      '<div class="header-main">' +
        '<button class="nav-toggle" aria-label="Menú" id="navToggle">☰</button>' +
        '<a class="brand" href="index.html">' + logo + '</a>' +
        '<form class="search" id="searchForm" role="search">' +
          '<input type="search" name="q" placeholder="Buscar repuestos, accesorios, marcas..." aria-label="Buscar">' +
          '<button type="submit" aria-label="Buscar">🔍</button>' +
        '</form>' +
        '<nav class="header-actions">' +
          '<a href="mi-cuenta.html" id="accountLink" class="action">👤 <span>Ingresar</span></a>' +
          '<a href="carrito.html" class="action cart-link">🛒 <span>Carrito</span>' +
            '<b class="cart-badge" id="cartBadge">0</b></a>' +
        '</nav>' +
      '</div>' +
      '<nav class="mainnav" id="mainnav">' +
        '<ul>' +
          '<li><a href="catalogo.html">Todos los productos</a></li>' +
          arbol.map(function (n) {
            var sub = n.hijos.length
              ? '<ul class="submenu">' + n.hijos.map(function (h) {
                  return '<li><a href="catalogo.html?categoria=' + esc(h.Slug || h.ID) + '">' + esc(h.Nombre) + '</a></li>';
                }).join('') + '</ul>'
              : '';
            return '<li class="' + (sub ? 'has-sub' : '') + '">' +
              '<a href="catalogo.html?categoria=' + esc(n.cat.Slug || n.cat.ID) + '">' + esc(n.cat.Nombre) + '</a>' +
              sub + '</li>';
          }).join('') +
          '<li><a href="index.html#nosotros">Nosotros</a></li>' +
          '<li><a href="index.html#contacto">Contacto</a></li>' +
        '</ul>' +
      '</nav>';

    var form = document.getElementById('searchForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = form.q.value.trim();
      window.location.href = 'catalogo.html?busqueda=' + encodeURIComponent(q);
    });
    var tg = document.getElementById('navToggle');
    if (tg) tg.addEventListener('click', function () {
      document.getElementById('mainnav').classList.toggle('open');
    });
  }

  function mountFooter(cfg) {
    var host = document.getElementById('site-footer');
    if (!host) return;
    var redes = [
      ['Instagram', cfg.Instagram], ['Facebook', cfg.Facebook], ['TikTok', cfg.TikTok],
      ['YouTube', cfg.YouTube], ['LinkedIn', cfg.LinkedIn]
    ].filter(function (r) { return r[1]; });

    host.innerHTML =
      '<div class="footer-cols">' +
        '<div>' +
          '<h4>' + esc(cfg.NombreTienda || 'Tienda Furi') + '</h4>' +
          (cfg.Direccion ? '<p>' + esc(cfg.Direccion) + '</p>' : '') +
          (cfg.Telefono ? '<p>Tel: ' + esc(cfg.Telefono) + '</p>' : '') +
          (cfg.Email ? '<p><a href="mailto:' + esc(cfg.Email) + '">' + esc(cfg.Email) + '</a></p>' : '') +
        '</div>' +
        '<div>' +
          '<h4>Ayuda</h4>' +
          '<p><a href="index.html#contacto">Contacto</a></p>' +
          '<p><a href="mi-cuenta.html">Mi cuenta / Mis pedidos</a></p>' +
          '<p><a href="carrito.html">Mi carrito</a></p>' +
        '</div>' +
        (redes.length ? '<div><h4>Seguinos</h4><p class="social">' +
          redes.map(function (r) {
            return '<a href="' + esc(r[1]) + '" target="_blank" rel="noopener">' + r[0] + '</a>';
          }).join(' · ') + '</p></div>' : '') +
      '</div>' +
      '<div class="footer-legal">' + esc(cfg.TextoFooterLegal || '') + '</div>';
  }

  function mountWhatsApp(cfg) {
    var num = String(cfg.WhatsApp || (F.config && F.config.WHATSAPP_FALLBACK) || '').replace(/[^\d]/g, '');
    if (!num) return;
    var a = document.createElement('a');
    a.className = 'wa-float';
    a.href = 'https://wa.me/' + num;
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'WhatsApp');
    a.textContent = '💬';
    document.body.appendChild(a);
  }

  function updateCartBadge() {
    var b = document.getElementById('cartBadge');
    if (!b) return;
    var n = F.Cart.count();
    b.textContent = n;
    b.style.display = n > 0 ? 'flex' : 'none';
  }

  function refreshSessionLink() {
    var a = document.getElementById('accountLink');
    if (!a) return;
    var c = F.Session.cliente();
    a.innerHTML = c
      ? '👤 <span>' + esc(c.Nombre || 'Mi cuenta') + '</span>'
      : '👤 <span>Ingresar</span>';
  }

  // ------------------------------------------------------------------- Toast
  function toast(msg, tipo) {
    var t = document.createElement('div');
    t.className = 'toast toast-' + (tipo || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 3200);
  }

  function loading(host, txt) {
    host.innerHTML = '<div class="loading">' + esc(txt || 'Cargando...') + '</div>';
  }
  function errorBox(host, txt) {
    host.innerHTML = '<div class="errorbox">' + esc(txt || 'Ocurrió un error.') + '</div>';
  }

  F.ui = {
    renderChrome: renderChrome,
    loadConfig: loadConfig,
    updateCartBadge: updateCartBadge,
    toast: toast,
    esc: esc,
    loading: loading,
    errorBox: errorBox
  };
})(window.FURI = window.FURI || {});
