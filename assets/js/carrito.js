(function (F) {
  'use strict';
  var esc = F.ui.esc;

  var metodos = [];
  var cupon = null;                 // { codigo, descuento }
  var envio = { codigo: '', costo: 0, etiqueta: '', requiereCoordinacion: false, calculando: false, error: '' };
  var destinoManual = { Provincia: '', CodigoPostal: '' };

  async function init() {
    await F.ui.renderChrome();
    try { metodos = await F.api.get('getMetodosEnvio'); } catch (e) { metodos = []; }

    var guardado = F.Envio.get();
    if (guardado) { envio.codigo = guardado.codigo; }

    document.addEventListener('furi:session-changed', function () { render(); recalcularEnvio(); });
    render();
  }

  function cli() { return F.Session.cliente(); }
  function clienteTieneDireccion() {
    var c = cli();
    return !!(c && c.Direccion && c.Provincia);
  }

  function render() {
    var root = document.getElementById('cartRoot');
    var items = F.Cart.items();

    if (!items.length) {
      root.innerHTML = '<div class="empty"><p>Tu carrito está vacío.</p>' +
        '<a class="btn" href="catalogo.html">Ver productos</a></div>';
      F.Envio.clear();
      return;
    }

    var rows = items.map(function (it, idx) {
      var variante = [it.color, it.talle].filter(Boolean).join(' / ');
      var may = F.Cart.esMayorista(it);
      var unit = F.Cart.precioUnit(it);
      return '<tr>' +
        '<td><div class="cart-item">' +
          '<img src="' + esc(F.img(it.imagen)) + '" alt="">' +
          '<div class="meta"><a href="producto.html?slug=' + esc(it.slug) + '"><b>' + esc(it.nombre) + '</b></a>' +
            (variante ? '<br><small>' + esc(variante) + '</small>' : '') +
            (may ? '<br><small style="color:var(--ok);font-weight:700">precio mayorista</small>' : '') +
            '<br><button class="link-danger" data-del="' + idx + '">Quitar</button>' +
          '</div></div></td>' +
        '<td>' + (may && Number(it.precio) > unit ? '<s style="color:var(--muted)">' + F.money(it.precio) + '</s><br>' : '') +
          F.money(unit) + '</td>' +
        '<td><div class="qty"><button data-dec="' + idx + '">−</button>' +
          '<input type="number" min="1" value="' + Number(it.cantidad) + '" data-qty="' + idx + '">' +
          '<button data-inc="' + idx + '">+</button></div>' +
          (!may && Number(it.umbralMayorista) > 0 && Number(it.precioMayorista) > 0
            ? '<div class="hint" style="font-size:.75rem;color:var(--muted);margin-top:4px">' +
              (Number(it.umbralMayorista) - Number(it.cantidad)) + ' u. más para precio mayorista</div>' : '') +
        '</td>' +
        '<td><b>' + F.money(unit * it.cantidad) + '</b></td>' +
      '</tr>';
    }).join('');

    root.innerHTML =
      '<div class="cart-layout">' +
        '<div>' +
          '<table class="cart-table"><thead><tr>' +
            '<th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>' +
          '<p style="margin-top:16px"><a href="catalogo.html">← Seguir comprando</a></p>' +
        '</div>' +
        '<aside class="summary" id="summary"></aside>' +
      '</div>';

    root.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { F.Cart.remove(+b.dataset.del); render(); recalcularEnvio(); };
    });
    root.querySelectorAll('[data-inc]').forEach(function (b) {
      b.onclick = function () { var i = +b.dataset.inc; F.Cart.setQty(i, F.Cart.items()[i].cantidad + 1); render(); recalcularEnvio(); };
    });
    root.querySelectorAll('[data-dec]').forEach(function (b) {
      b.onclick = function () { var i = +b.dataset.dec; F.Cart.setQty(i, F.Cart.items()[i].cantidad - 1); render(); recalcularEnvio(); };
    });
    root.querySelectorAll('[data-qty]').forEach(function (inp) {
      inp.onchange = function () { F.Cart.setQty(+inp.dataset.qty, inp.value); render(); recalcularEnvio(); };
    });

    renderSummary();
  }

  function renderSummary() {
    var host = document.getElementById('summary');
    if (!host) return;
    var subtotal = F.Cart.subtotal();
    var desc = cupon ? cupon.descuento : 0;
    var costoEnvio = envio.calculando ? null : envio.costo;
    var total = subtotal - desc + (costoEnvio || 0);

    host.innerHTML =
      '<h3>Resumen</h3>' +
      '<div class="coupon">' +
        '<input id="cuponInput" placeholder="Cupón de descuento" value="' + esc(cupon ? cupon.codigo : '') + '">' +
        '<button class="btn btn-sm" id="cuponBtn">' + (cupon ? 'Quitar' : 'Aplicar') + '</button>' +
      '</div>' +
      '<div id="cuponMsg"></div>' +

      '<div class="ship-opts">' +
        '<div class="lbl" style="font-weight:600;font-size:.9rem">Método de envío</div>' +
        metodos.map(renderShipOpt).join('') +
      '</div>' +
      shipExtraHTML() +

      (F.Cart.hayMayorista() ? '<p class="notice" style="margin:8px 0">✔ Estás pagando <b>precio mayorista</b> en tu compra.</p>' : '') +
      '<div class="row"><span>Subtotal</span><span>' + F.money(subtotal) + '</span></div>' +
      (desc > 0 ? '<div class="row"><span>Descuento (' + esc(cupon.codigo) + ')</span><span>- ' + F.money(desc) + '</span></div>' : '') +
      '<div class="row"><span>Envío' + (envio.etiqueta ? ' · ' + esc(envio.etiqueta) : '') + '</span><span>' +
        (envio.calculando ? 'Calculando…' :
          !envio.codigo ? 'Elegí una opción' :
          envio.error ? '<span style="color:var(--c-primario)">' + esc(envio.error) + '</span>' :
          envio.costo > 0 ? F.money(envio.costo) : 'Sin cargo') +
      '</span></div>' +

      '<div class="row total"><span>Total</span><span>' +
        (envio.calculando || !envio.codigo ? F.money(subtotal - desc) + ' +' : F.money(total)) + '</span></div>' +

      (envio.requiereCoordinacion ? '<p class="notice" style="margin-top:12px">📦 Nos vamos a contactar con vos para coordinar la entrega.</p>' : '') +

      '<button class="btn btn-block btn-lg" id="checkoutBtn" style="margin-top:16px" ' +
        (puedeAvanzar() ? '' : 'disabled') + '>Continuar con la compra</button>' +
      (F.Cart.todoEnvioGratis() ? '<p class="muted" style="font-size:.8rem;margin-top:8px">Todos los productos del carrito tienen envío gratis.</p>' : '');

    wireSummary();
  }

  function renderShipOpt(m) {
    var sel = envio.codigo === m.Codigo ? ' sel' : '';
    var bloqueada = m.Codigo === 'domicilio_acordado' && !clienteTieneDireccion();
    return '<label class="ship-opt' + sel + (bloqueada ? ' disabled' : '') + '">' +
      '<span class="name"><span><input type="radio" name="envio" value="' + esc(m.Codigo) + '" ' +
        (sel ? 'checked' : '') + '> ' + esc(m.Nombre) + '</span></span>' +
      (m.Descripcion ? '<span class="desc">' + esc(m.Descripcion) + '</span>' : '') +
      (bloqueada ? '<span class="warn">Necesitás iniciar sesión y tener una dirección cargada. ' +
        '<a href="mi-cuenta.html">Ingresar</a></span>' : '') +
    '</label>';
  }

  function shipExtraHTML() {
    if (envio.codigo !== 'andreani' || clienteTieneDireccion()) return '';
    return '<div class="form-grid" style="margin:6px 0 14px">' +
      '<div class="field"><label>Provincia</label><input id="destProv" value="' + esc(destinoManual.Provincia) + '" placeholder="Ej: Córdoba"></div>' +
      '<div class="field"><label>Código postal</label><input id="destCP" value="' + esc(destinoManual.CodigoPostal) + '" placeholder="Ej: 5000"></div>' +
      '<div class="field col-2"><button class="btn btn-sm" id="estimarBtn">Estimar envío</button></div>' +
    '</div>';
  }

  function puedeAvanzar() {
    if (!F.Cart.items().length) return false;
    if (!envio.codigo) return false;
    if (envio.calculando || envio.error) return false;
    if (envio.codigo === 'domicilio_acordado' && !clienteTieneDireccion()) return false;
    return true;
  }

  function wireSummary() {
    var host = document.getElementById('summary');

    host.querySelector('#cuponBtn').onclick = async function () {
      if (cupon) { cupon = null; renderSummary(); return; }
      var code = host.querySelector('#cuponInput').value.trim();
      if (!code) return;
      var msg = host.querySelector('#cuponMsg');
      msg.innerHTML = '<p class="muted">Validando…</p>';
      try {
        var r = await F.api.post('validarCupon', { codigo: code, subtotal: F.Cart.subtotal() });
        cupon = { codigo: r.codigo, descuento: r.descuento };
        msg.innerHTML = '<p style="color:var(--ok);font-size:.85rem">Cupón aplicado: -' + F.money(r.descuento) + '</p>';
        renderSummary();
      } catch (e) {
        cupon = null;
        msg.innerHTML = '<p class="errorbox" style="font-size:.85rem">' + esc(e.message) + '</p>';
      }
    };

    host.querySelectorAll('input[name="envio"]').forEach(function (r) {
      r.onchange = function () {
        envio.codigo = r.value;
        F.Envio.set({ codigo: envio.codigo });
        recalcularEnvio();
      };
    });

    var est = host.querySelector('#estimarBtn');
    if (est) est.onclick = function () {
      destinoManual.Provincia = host.querySelector('#destProv').value.trim();
      destinoManual.CodigoPostal = host.querySelector('#destCP').value.trim();
      recalcularEnvio();
    };

    var cb = host.querySelector('#checkoutBtn');
    if (cb) cb.onclick = function () {
      F.Envio.set({
        codigo: envio.codigo, costo: envio.costo, etiqueta: envio.etiqueta,
        requiereCoordinacion: envio.requiereCoordinacion,
        cupon: cupon ? cupon.codigo : '',
        destinoManual: destinoManual
      });
      window.location.href = 'checkout.html';
    };
  }

  async function recalcularEnvio() {
    if (!envio.codigo || !F.Cart.items().length) { renderSummary(); return; }
    var m = metodos.find(function (x) { return x.Codigo === envio.codigo; });

    if (envio.codigo === 'retiro_local') {
      envio = { codigo: envio.codigo, costo: 0, etiqueta: 'Retiro en el local', requiereCoordinacion: true, calculando: false, error: '' };
      persistAndRender(); return;
    }
    if (envio.codigo === 'domicilio_acordado') {
      envio = { codigo: envio.codigo, costo: Number(m && m.CostoFijo) || 0, etiqueta: 'A domicilio (a coordinar)',
        requiereCoordinacion: true, calculando: false, error: clienteTieneDireccion() ? '' : '' };
      persistAndRender(); return;
    }

    // Andreani -> backend
    var c = cli();
    var destino = clienteTieneDireccion()
      ? { Provincia: c.Provincia, CodigoPostal: c.CodigoPostal }
      : destinoManual;
    if (!destino.Provincia) {
      envio = { codigo: envio.codigo, costo: 0, etiqueta: '', requiereCoordinacion: false, calculando: false,
        error: 'Indicá provincia y CP' };
      renderSummary(); return;
    }
    envio.calculando = true; renderSummary();
    try {
      var r = await F.api.post('calcularEnvio', {
        metodoEnvioCodigo: 'andreani', destino: destino,
        pesoTotal: F.Cart.pesoTotal(), subtotal: F.Cart.subtotal()
      });
      envio = { codigo: 'andreani', costo: Number(r.costo) || 0, etiqueta: r.etiqueta || 'Andreani',
        requiereCoordinacion: !!r.requiereCoordinacion, calculando: false, error: '' };
    } catch (e) {
      envio = { codigo: 'andreani', costo: 0, etiqueta: '', requiereCoordinacion: false, calculando: false, error: e.message };
    }
    persistAndRender();
  }

  function persistAndRender() {
    F.Envio.set({
      codigo: envio.codigo, costo: envio.costo, etiqueta: envio.etiqueta,
      requiereCoordinacion: envio.requiereCoordinacion,
      cupon: cupon ? cupon.codigo : '', destinoManual: destinoManual
    });
    renderSummary();
  }

  init();
})(window.FURI = window.FURI || {});
