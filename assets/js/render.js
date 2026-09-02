/**
 * Componentes de render compartidos entre páginas.
 */
(function (F) {
  'use strict';
  var esc = F.ui.esc;

  /** Tarjeta de producto para grillas (home, catálogo, similares). */
  function productCardHTML(p) {
    var pr = p.precios || {};
    var href = 'producto.html?slug=' + encodeURIComponent(p.Slug || p.ID);
    var badges = [];
    if (pr.descuento > 0) badges.push('<span class="badge off">-' + Math.round(pr.descuento) + '%</span>');
    if (p.EnvioGratis) badges.push('<span class="badge free">Envío gratis</span>');
    if (Number(p.StockTotal) > 0 && Number(p.StockTotal) <= 5) badges.push('<span class="badge low">Últimas unidades</span>');
    var agotado = Number(p.StockTotal) <= 0 && (!p.variantes || !p.variantes.length);

    return '' +
      '<article class="card">' +
        '<a class="thumb" href="' + href + '">' +
          '<div class="badges">' + badges.join('') + '</div>' +
          '<img loading="lazy" src="' + esc(F.img(p.ImagenPrincipalURL)) + '" alt="' + esc(p.Nombre) + '">' +
        '</a>' +
        '<div class="body">' +
          (p.MarcaNombre ? '<span class="brandname">' + esc(p.MarcaNombre) + '</span>' : '') +
          '<h3><a href="' + href + '">' + esc(p.Nombre) + '</a></h3>' +
          '<div class="price-line">' +
            (pr.descuento > 0 ? '<span class="price-old">' + F.money(pr.precioLista) + '</span>' : '') +
            '<span class="price-now">' + F.money(pr.precioFinal) + '</span>' +
          '</div>' +
          (pr.precioTransferencia && pr.precioTransferencia < pr.precioFinal
            ? '<span class="price-transf">' + F.money(pr.precioTransferencia) + ' con transferencia</span>' : '') +
          (pr.cuotasCantidad > 0
            ? '<span class="price-cuotas">' + pr.cuotasCantidad + '&times; ' + F.money(pr.valorCuota) +
              (pr.cuotasSinInteres ? ' sin interés' : '') + '</span>' : '') +
          (pr.tieneMayorista && pr.umbralMayorista > 0
            ? '<span class="price-cuotas" style="color:var(--ok)">x mayor (' + pr.umbralMayorista + '+): ' + F.money(pr.precioMayorista) + '</span>' : '') +
          '<a class="btn btn-sm ' + (agotado ? 'btn-ghost' : '') + '" href="' + href + '">' +
            (agotado ? 'Sin stock' : 'Ver producto') + '</a>' +
        '</div>' +
      '</article>';
  }

  function grid(host, productos, vacio) {
    if (!productos || !productos.length) {
      host.innerHTML = '<div class="empty">' + esc(vacio || 'No hay productos para mostrar.') + '</div>';
      return;
    }
    host.innerHTML = productos.map(productCardHTML).join('');
  }

  F.render = { productCardHTML: productCardHTML, grid: grid };
})(window.FURI = window.FURI || {});
