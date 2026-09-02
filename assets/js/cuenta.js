(function (F) {
  'use strict';
  var esc = F.ui.esc;

  async function init() {
    await F.ui.renderChrome();
    document.addEventListener('furi:session-changed', route);
    route();
  }

  function route() {
    if (F.Session.logueado()) renderPanel();
    else renderAuth();
  }

  // ------------------------------------------------------------------- Auth
  function renderAuth() {
    document.getElementById('cuentaTitulo').textContent = 'Ingresá a tu cuenta';
    var root = document.getElementById('cuentaRoot');
    root.innerHTML =
    '<div class="checkout-layout">' +
      '<div class="card-box">' +
        '<h3>Iniciar sesión</h3>' +
        '<form id="loginForm">' +
          '<div class="field col-2"><label>Email</label><input type="email" name="email" required></div>' +
          '<div class="field col-2" style="margin-top:10px"><label>Contraseña</label><input type="password" name="password" required></div>' +
          '<div id="loginErr"></div>' +
          '<button class="btn btn-block" style="margin-top:16px">Ingresar</button>' +
          '<p style="margin-top:10px"><a href="#" id="recLink" class="muted" style="font-size:.85rem">Olvidé mi contraseña</a></p>' +
        '</form>' +
      '</div>' +
      '<div class="card-box">' +
        '<h3>Crear cuenta</h3>' +
        '<form id="regForm">' +
          '<div class="form-grid">' +
            '<div class="field"><label>Nombre *</label><input name="Nombre" required></div>' +
            '<div class="field"><label>Apellido</label><input name="Apellido"></div>' +
            '<div class="field col-2"><label>Email *</label><input type="email" name="Email" required></div>' +
            '<div class="field"><label>Contraseña *</label><input type="password" name="Password" minlength="6" required></div>' +
            '<div class="field"><label>Teléfono</label><input name="Telefono"></div>' +
            '<div class="field col-2"><label>Dirección</label><input name="Direccion"></div>' +
            '<div class="field"><label>Ciudad</label><input name="Ciudad"></div>' +
            '<div class="field"><label>Provincia</label><input name="Provincia"></div>' +
            '<div class="field"><label>Código postal</label><input name="CodigoPostal"></div>' +
            '<div class="field"><label>DNI / CUIT</label><input name="DNI_CUIT"></div>' +
          '</div>' +
          '<div id="regErr"></div>' +
          '<button class="btn btn-block" style="margin-top:16px">Crear cuenta</button>' +
        '</form>' +
      '</div>' +
    '</div>';

    document.getElementById('loginForm').onsubmit = async function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target).entries());
      var err = document.getElementById('loginErr'); err.innerHTML = '';
      try {
        var r = await F.api.post('loginCliente', { email: d.email, password: d.password });
        F.Session.set({ token: r.token, cliente: r.cliente });
      } catch (ex) { err.innerHTML = '<div class="errorbox">' + esc(ex.message) + '</div>'; }
    };

    document.getElementById('regForm').onsubmit = async function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target).entries());
      var err = document.getElementById('regErr'); err.innerHTML = '';
      try {
        var r = await F.api.post('registrarCliente', { cliente: d });
        F.Session.set({ token: r.token, cliente: r.cliente });
        F.ui.toast('¡Cuenta creada!', 'ok');
      } catch (ex) { err.innerHTML = '<div class="errorbox">' + esc(ex.message) + '</div>'; }
    };

    document.getElementById('recLink').onclick = async function (e) {
      e.preventDefault();
      var email = prompt('Ingresá tu email para recuperar la contraseña:');
      if (!email) return;
      try {
        var r = await F.api.post('recuperarPassword', { email: email });
        F.ui.toast(r.mensaje || 'Revisá tu email.', 'ok');
      } catch (ex) { F.ui.toast(ex.message, 'error'); }
    };
  }

  // ------------------------------------------------------------------ Panel
  async function renderPanel() {
    var c = F.Session.cliente();
    document.getElementById('cuentaTitulo').textContent = 'Hola, ' + (c.Nombre || '');
    var root = document.getElementById('cuentaRoot');
    root.innerHTML =
    '<div class="checkout-layout">' +
      '<div class="card-box">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<h3>Mis datos</h3><button class="btn btn-ghost btn-sm" id="logoutBtn">Cerrar sesión</button>' +
        '</div>' +
        '<form id="perfilForm">' +
          '<div class="form-grid">' +
            inp('Nombre', 'Nombre', c.Nombre) + inp('Apellido', 'Apellido', c.Apellido) +
            inp('Teléfono', 'Telefono', c.Telefono) + inp('DNI / CUIT', 'DNI_CUIT', c.DNI_CUIT) +
            inp('Dirección', 'Direccion', c.Direccion, 'col-2') +
            inp('Ciudad', 'Ciudad', c.Ciudad) + inp('Provincia', 'Provincia', c.Provincia) +
            inp('Código postal', 'CodigoPostal', c.CodigoPostal) +
          '</div>' +
          '<div id="perfilMsg"></div>' +
          '<button class="btn" style="margin-top:14px">Guardar cambios</button>' +
        '</form>' +
      '</div>' +
      '<div>' +
        '<h3>Mis pedidos</h3>' +
        '<div id="pedidosList"><div class="loading">Cargando pedidos...</div></div>' +
      '</div>' +
    '</div>';

    document.getElementById('logoutBtn').onclick = function () { F.Session.clear(); };

    document.getElementById('perfilForm').onsubmit = async function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target).entries());
      var msg = document.getElementById('perfilMsg'); msg.innerHTML = '';
      try {
        var r = await F.api.post('actualizarPerfilCliente', { token: F.Session.token(), datos: d });
        F.Session.set({ token: F.Session.token(), cliente: r.cliente });
        msg.innerHTML = '<p style="color:var(--ok);font-size:.85rem">Datos guardados.</p>';
      } catch (ex) { msg.innerHTML = '<div class="errorbox">' + esc(ex.message) + '</div>'; }
    };

    try {
      var pedidos = await F.api.post('getMisPedidos', { token: F.Session.token() });
      renderPedidos(pedidos.data || []);
    } catch (ex) {
      document.getElementById('pedidosList').innerHTML = '<div class="errorbox">' + esc(ex.message) + '</div>';
    }
  }

  function inp(label, name, val, cls) {
    return '<div class="field ' + (cls || '') + '"><label>' + esc(label) + '</label>' +
      '<input name="' + name + '" value="' + esc(val || '') + '"></div>';
  }

  function renderPedidos(list) {
    var host = document.getElementById('pedidosList');
    if (!list.length) { host.innerHTML = '<div class="empty">Todavía no hiciste pedidos.</div>'; return; }
    host.innerHTML = list.map(function (p) {
      return '<div class="card-box" style="margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
          '<b>#' + esc(String(p.ID).slice(0, 8).toUpperCase()) + '</b>' +
          '<span class="tag-estado ' + esc(p.EstadoPago) + '">' + esc(p.EstadoPago) + '</span>' +
        '</div>' +
        '<div class="muted" style="font-size:.82rem;margin:4px 0 10px">' + esc(p.Fecha) + ' · ' + esc(p.MetodoEnvioNombre) + '</div>' +
        p.items.map(function (it) {
          var v = [it.Color, it.Talle].filter(Boolean).join(' / ');
          return '<div class="row" style="display:flex;justify-content:space-between;font-size:.88rem">' +
            '<span>' + esc(it.NombreProducto) + (v ? ' (' + esc(v) + ')' : '') + ' × ' + it.Cantidad + '</span>' +
            '<span>' + F.money(it.Subtotal) + '</span></div>';
        }).join('') +
        '<div class="row total" style="display:flex;justify-content:space-between;font-size:1rem;font-weight:800;border-top:1px solid var(--line);margin-top:8px;padding-top:8px">' +
          '<span>Total</span><span>' + F.money(p.Total) + '</span></div>' +
        (p.RequiereCoordinacion ? '<p class="notice" style="margin-top:8px;font-size:.82rem">Coordinación: ' + esc(p.EstadoCoordinacion || 'pendiente') + '</p>' : '') +
      '</div>';
    }).join('');
  }

  init();
})(window.FURI = window.FURI || {});
