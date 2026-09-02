(function (F) {
  'use strict';
  var esc = F.ui.esc;
  var envioSel = null, metodos = [];

  async function init() {
    await F.ui.renderChrome();
    var root = document.getElementById('checkoutRoot');

    if (!F.Cart.items().length) {
      root.innerHTML = '<div class="empty"><p>Tu carrito está vacío.</p><a class="btn" href="catalogo.html">Ver productos</a></div>';
      return;
    }

    envioSel = F.Envio.get();
    try { metodos = await F.api.get('getMetodosEnvio'); } catch (e) { metodos = []; }

    if (!envioSel || !envioSel.codigo) {
      root.innerHTML = '<div class="notice">Primero elegí un método de envío en el carrito.</div>' +
        '<p style="margin-top:16px"><a class="btn" href="carrito.html">Volver al carrito</a></p>';
      return;
    }

    render();
  }

  function render() {
    var root = document.getElementById('checkoutRoot');
    var c = F.Session.cliente() || {};
    var m = metodos.find(function (x) { return x.Codigo === envioSel.codigo; }) || {};
    var items = F.Cart.items();
    var subtotal = F.Cart.subtotal();
    var costoEnvio = Number(envioSel.costo) || 0;
    var descuento = 0; // se recalcula en backend; acá informativo

    root.innerHTML =
    '<div class="checkout-layout">' +
      '<div class="card-box">' +
        (F.Session.logueado()
          ? '<p class="notice">Comprando como <b>' + esc(c.Nombre || c.Email) + '</b>. ' +
            '<a href="#" id="logoutLink">Salir</a></p>'
          : '<p class="notice">Estás comprando como invitado. ' +
            '<a href="mi-cuenta.html">Iniciá sesión</a> para usar tus datos guardados.</p>') +

        '<form id="chkForm">' +
          '<h3>Datos de contacto</h3>' +
          '<div class="form-grid">' +
            field('Nombre', 'Nombre', c.Nombre, true) +
            field('Apellido', 'Apellido', c.Apellido) +
            field('Email', 'Email', c.Email, true, 'email') +
            field('Teléfono', 'Telefono', c.Telefono, true) +
            field('DNI / CUIT', 'DNI_CUIT', c.DNI_CUIT) +
          '</div>' +

          (needsAddress() ?
            '<h3 style="margin-top:24px">Dirección de entrega</h3>' +
            '<div class="form-grid">' +
              field('Calle y número', 'Direccion', c.Direccion, true, 'text', 'col-2') +
              field('Ciudad', 'Ciudad', c.Ciudad, true) +
              field('Provincia', 'Provincia', c.Provincia || (envioSel.destinoManual && envioSel.destinoManual.Provincia), true) +
              field('Código postal', 'CodigoPostal', c.CodigoPostal || (envioSel.destinoManual && envioSel.destinoManual.CodigoPostal), true) +
            '</div>'
            : '') +

          (!F.Session.logueado() ?
            '<label style="display:flex;gap:8px;margin-top:16px;font-size:.9rem">' +
              '<input type="checkbox" id="crearCuenta"> Quiero crear una cuenta para seguir mis pedidos' +
            '</label>' +
            '<div class="field col-2" id="passWrap" style="display:none;margin-top:10px">' +
              '<label>Contraseña</label><input type="password" name="Password" minlength="6">' +
            '</div>'
            : '') +

          '<div id="chkError"></div>' +
          '<button class="btn btn-lg btn-block" type="submit" id="payBtn" style="margin-top:20px">' +
            'Pagar con Mercado Pago</button>' +
          '<p class="muted center" style="font-size:.8rem;margin-top:10px">Serás redirigido a Mercado Pago para completar el pago de forma segura.</p>' +
        '</form>' +
      '</div>' +

      '<aside class="summary">' +
        '<h3>Tu pedido</h3>' +
        items.map(function (it) {
          var v = [it.color, it.talle].filter(Boolean).join(' / ');
          var may = F.Cart.esMayorista(it);
          return '<div class="row"><span>' + esc(it.nombre) + (v ? ' <small>(' + esc(v) + ')</small>' : '') +
            (may ? ' <small style="color:var(--ok)">· mayorista</small>' : '') +
            ' × ' + it.cantidad + '</span><span>' + F.money(F.Cart.precioUnit(it) * it.cantidad) + '</span></div>';
        }).join('') +
        '<div class="row" style="border-top:1px solid var(--line);margin-top:8px;padding-top:10px">' +
          '<span>Subtotal</span><span>' + F.money(subtotal) + '</span></div>' +
        '<div class="row"><span>Envío · ' + esc(m.Nombre || envioSel.codigo) + '</span><span>' +
          (costoEnvio > 0 ? F.money(costoEnvio) : 'Sin cargo / a coordinar') + '</span></div>' +
        (envioSel.cupon ? '<div class="row"><span>Cupón ' + esc(envioSel.cupon) + '</span><span>se aplica al pagar</span></div>' : '') +
        '<div class="row total"><span>Total</span><span>' + F.money(subtotal + costoEnvio) + '</span></div>' +
        (envioSel.requiereCoordinacion ? '<p class="notice" style="margin-top:12px">📦 Coordinamos la entrega con vos después de la compra.</p>' : '') +
        '<p style="margin-top:12px"><a href="carrito.html">← Editar carrito</a></p>' +
      '</aside>' +
    '</div>';

    wire();
  }

  function field(label, name, val, req, type, cls) {
    return '<div class="field ' + (cls || '') + '">' +
      '<label>' + esc(label) + (req ? ' *' : '') + '</label>' +
      '<input type="' + (type || 'text') + '" name="' + name + '" value="' + esc(val || '') + '" ' +
      (req ? 'required' : '') + '></div>';
  }

  function needsAddress() {
    return envioSel.codigo === 'domicilio_acordado' || envioSel.codigo === 'andreani';
  }

  function wire() {
    var form = document.getElementById('chkForm');
    var logout = document.getElementById('logoutLink');
    if (logout) logout.onclick = function (e) { e.preventDefault(); F.Session.clear(); location.reload(); };

    var chk = document.getElementById('crearCuenta');
    if (chk) chk.onchange = function () {
      document.getElementById('passWrap').style.display = chk.checked ? 'flex' : 'none';
      form.Password.required = chk.checked;
    };

    form.onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('payBtn');
      var errBox = document.getElementById('chkError');
      errBox.innerHTML = '';
      var datos = Object.fromEntries(new FormData(form).entries());

      btn.disabled = true; btn.textContent = 'Generando pago...';
      try {
        // Registro opcional
        if (chk && chk.checked && datos.Password) {
          try {
            var reg = await F.api.post('registrarCliente', { cliente: datos });
            F.Session.set({ token: reg.token, cliente: reg.cliente });
          } catch (regErr) {
            F.ui.toast('No se pudo crear la cuenta: ' + regErr.message + '. Seguimos como invitado.', 'error');
          }
        }

        var carrito = F.Cart.items().map(function (it) {
          return { productoId: it.productoId, varianteId: it.varianteId || '', cantidad: it.cantidad };
        });

        var r = await F.api.post('crearPreferenciaPago', {
          carrito: carrito,
          datosCliente: datos,
          metodoEnvioCodigo: envioSel.codigo,
          cupon: envioSel.cupon || '',
          clienteToken: F.Session.token() || ''
        });

        try {
          localStorage.setItem('furi_last_order', JSON.stringify({ pedidoId: r.pedidoId, email: datos.Email }));
        } catch (e2) {}

        var url = r.init_point || r.sandbox_init_point;
        if (!url) throw new Error('Mercado Pago no devolvió un link de pago.');
        window.location.href = url;
      } catch (err) {
        errBox.innerHTML = '<div class="errorbox">' + esc(err.message) + '</div>';
        btn.disabled = false; btn.textContent = 'Pagar con Mercado Pago';
      }
    };
  }

  init();
})(window.FURI = window.FURI || {});
