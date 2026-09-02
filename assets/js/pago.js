(function (F) {
  'use strict';
  var esc = F.ui.esc;

  var TEXTOS = {
    exito:     { ico: '✅', h: '¡Gracias por tu compra!', p: 'Tu pago fue procesado. Te enviamos el comprobante por email.' },
    pendiente: { ico: '⏳', h: 'Tu pago está pendiente', p: 'Cuando Mercado Pago lo confirme te vamos a avisar por email.' },
    fallido:   { ico: '❌', h: 'No pudimos procesar el pago', p: 'No se realizó ningún cobro. Podés volver a intentarlo desde el carrito.' }
  };

  async function init() {
    await F.ui.renderChrome();
    var tipo = document.body.getAttribute('data-result') || 'pendiente';
    var t = TEXTOS[tipo];
    var root = document.getElementById('resultRoot');

    var pedidoId = F.qs('pedido') || F.qs('external_reference');
    var last = null;
    try { last = JSON.parse(localStorage.getItem('furi_last_order')); } catch (e) {}
    if (!pedidoId && last) pedidoId = last.pedidoId;

    if (tipo === 'exito') F.Cart.clear();

    root.innerHTML =
      '<div class="result-box">' +
        '<div class="ico">' + t.ico + '</div>' +
        '<h1>' + t.h + '</h1>' +
        '<p class="muted">' + t.p + '</p>' +
        '<div id="pedidoInfo" style="margin:24px 0"></div>' +
        '<a class="btn" href="catalogo.html">Seguir comprando</a> ' +
        '<a class="btn btn-ghost" href="mi-cuenta.html">Ver mis pedidos</a>' +
      '</div>';

    if (!pedidoId) return;
    var info = document.getElementById('pedidoInfo');
    info.innerHTML = '<p class="muted">Consultando pedido…</p>';
    try {
      var r = await F.api.get('consultarEstadoPedido', { pedidoId: pedidoId, email: last && last.email });
      var p = r.pedido;
      info.innerHTML =
        '<div class="card-box" style="text-align:left;max-width:420px;margin:0 auto">' +
          '<div class="row" style="display:flex;justify-content:space-between"><span>Pedido</span>' +
            '<b>#' + esc(String(p.ID).slice(0, 8).toUpperCase()) + '</b></div>' +
          '<div class="row" style="display:flex;justify-content:space-between;margin-top:6px"><span>Estado del pago</span>' +
            '<span class="tag-estado ' + esc(p.EstadoPago) + '">' + esc(p.EstadoPago) + '</span></div>' +
          '<div class="row" style="display:flex;justify-content:space-between;margin-top:6px"><span>Envío</span>' +
            '<span>' + esc(p.MetodoEnvioNombre) + '</span></div>' +
          '<div class="row" style="display:flex;justify-content:space-between;margin-top:6px"><span>Total</span>' +
            '<b>' + F.money(p.Total) + '</b></div>' +
          (p.RequiereCoordinacion ? '<p class="notice" style="margin-top:12px">📦 Nos comunicamos con vos para coordinar la entrega.</p>' : '') +
        '</div>';
    } catch (e) {
      info.innerHTML = '<p class="muted">Pedido #' + esc(String(pedidoId).slice(0, 8).toUpperCase()) + '</p>';
    }
  }

  init();
})(window.FURI = window.FURI || {});
