(function (F) {
  'use strict';
  var esc = F.ui.esc;
  var P = null, sel = { color: '', talle: '', cantidad: 1 };

  async function init() {
    await F.ui.renderChrome();
    var slug = F.qs('slug') || F.qs('id');
    if (!slug) { F.ui.errorBox(document.getElementById('pdp'), 'Falta el producto.'); return; }
    try {
      P = await F.api.get('getProducto', { slug: slug });
    } catch (e) {
      F.ui.errorBox(document.getElementById('pdp'), e.message);
      return;
    }
    document.title = P.Nombre + ' · ' + ((F.cfg && F.cfg.NombreTienda) || 'Tienda Furi');
    render();
    renderSimilares();
  }

  function variantes() { return P.variantes || []; }
  function tieneVariantes() { return variantes().length > 0; }
  function colores() { return uniq(variantes().map(function (v) { return v.Color; }).filter(String)); }
  function talles() { return uniq(variantes().map(function (v) { return v.Talle; }).filter(String)); }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  function varianteActual() {
    var vs = variantes();
    if (!vs.length) return null;
    return vs.find(function (v) {
      return (!colores().length || String(v.Color) === String(sel.color)) &&
             (!talles().length || String(v.Talle) === String(sel.talle));
    }) || null;
  }

  function stockDisponible() {
    if (!tieneVariantes()) return Number(P.StockTotal) || 0;
    var v = varianteActual();
    return v ? Number(v.Stock) || 0 : -1; // -1 = falta elegir
  }

  function render() {
    var pr = P.precios || {};
    var galeria = [P.ImagenPrincipalURL].concat(P.Galeria || []).filter(String);
    if (!galeria.length) galeria = [F.PLACEHOLDER_IMG];

    var html = '' +
    '<div class="breadcrumb"><a href="index.html">Inicio</a> / <a href="catalogo.html">Catálogo</a>' +
      (P.CategoriaNombre ? ' / <a href="catalogo.html?categoria=' + esc(P.CategoriaID) + '">' + esc(P.CategoriaNombre) + '</a>' : '') +
      ' / <span>' + esc(P.Nombre) + '</span></div>' +
    '<div class="pdp">' +
      '<div class="gallery">' +
        '<div class="main"><img id="mainImg" src="' + esc(galeria[0]) + '" alt="' + esc(P.Nombre) + '"></div>' +
        (galeria.length > 1 ? '<div class="thumbs">' + galeria.map(function (g, i) {
          return '<img src="' + esc(g) + '" class="' + (i === 0 ? 'sel' : '') + '" data-g="' + esc(g) + '" alt="">';
        }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="pdp-info">' +
        (P.MarcaNombre ? '<div class="brandname">' + esc(P.MarcaNombre) + '</div>' : '') +
        '<h1>' + esc(P.Nombre) + '</h1>' +
        (P.SKU ? '<div class="sku">SKU: ' + esc(P.SKU) + '</div>' : '') +
        (P.DescripcionCorta ? '<p class="muted">' + esc(P.DescripcionCorta) + '</p>' : '') +
        '<div class="prices" id="priceBlock">' + preciosHTML(1) + '</div>' +
        mayoristaHintHTML() +
        (P.EnvioGratis ? '<p><span class="badge free">Envío gratis</span></p>' : '') +
        variantesHTML() +
        '<div class="variant-row"><div class="lbl">Cantidad</div>' +
          '<div class="qty"><button type="button" data-q="-1">−</button>' +
          '<input id="qtyInput" type="number" min="1" value="1"><button type="button" data-q="1">+</button></div>' +
        '</div>' +
        '<div class="stock-note" id="stockNote"></div>' +
        '<div class="buy-actions">' +
          '<button class="btn btn-lg" id="addBtn">Agregar al carrito</button>' +
          '<a class="btn btn-ghost btn-lg" href="carrito.html">Ir al carrito</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
    tabsHTML();

    document.getElementById('pdp').innerHTML = html;
    wire();
    updateStockNote();
  }

  /** Bloque de precios para una cantidad dada (aplica precio mayorista si corresponde). */
  function preciosHTML(qty) {
    var pr = P.precios || {};
    var may = pr.tieneMayorista && pr.umbralMayorista > 0 && qty >= pr.umbralMayorista;
    var final = may ? pr.precioMayorista : pr.precioFinal;
    var lista = may ? pr.precioMayoristaLista : pr.precioLista;
    var transf = may ? pr.precioMayoristaTransferencia : pr.precioTransferencia;
    var cuota = may ? pr.valorCuotaMayorista : pr.valorCuota;
    return (
      (may ? '<span class="badge free">Precio mayorista · ' + pr.umbralMayorista + '+ u.</span> ' : '') +
      (pr.descuento > 0 ? '<span class="price-old">' + F.money(lista) + '</span> ' +
        '<span class="badge off">-' + Math.round(pr.descuento) + '%</span>' : '') +
      '<div class="price-now">' + F.money(final) + '</div>' +
      (transf && transf < final
        ? '<span class="price-transf">' + F.money(transf) + ' pagando con transferencia</span>' : '') +
      (pr.cuotasCantidad > 0
        ? '<span class="price-cuotas">' + pr.cuotasCantidad + ' cuotas de ' + F.money(cuota) +
          (pr.cuotasSinInteres ? ' <b>sin interés</b>' : '') + '</span>' : '')
    );
  }

  function mayoristaHintHTML() {
    var pr = P.precios || {};
    if (!pr.tieneMayorista || !(pr.umbralMayorista > 0)) return '';
    return '<p class="notice" id="mayoristaHint">Comprando <b>' + pr.umbralMayorista +
      ' o más unidades</b> pagás <b>' + F.money(pr.precioMayorista) + '</b> cada una (precio mayorista).</p>';
  }

  function refreshPrecios() {
    var qtyEl = document.getElementById('qtyInput');
    if (!qtyEl) return;
    var qty = parseInt(qtyEl.value, 10) || 1;
    var pb = document.getElementById('priceBlock');
    if (pb) pb.innerHTML = preciosHTML(qty);
  }

  function variantesHTML() {
    if (!tieneVariantes()) return '';
    var out = '';
    if (colores().length) {
      out += '<div class="variant-row"><div class="lbl">Color</div>' +
        colores().map(function (c) {
          return '<button type="button" class="opt" data-color="' + esc(c) + '">' + esc(c) + '</button>';
        }).join(' ') + '</div>';
    }
    if (talles().length) {
      out += '<div class="variant-row"><div class="lbl">Talle</div>' +
        talles().map(function (t) {
          return '<button type="button" class="opt" data-talle="' + esc(t) + '">' + esc(t) + '</button>';
        }).join(' ') + '</div>';
    }
    return out;
  }

  function tabsHTML() {
    var carac = caracteristicasHTML(P.CaracteristicasAdicionales);
    var ficha = [
      ['Marca', P.MarcaNombre], ['Categoría', P.CategoriaNombre], ['Género', P.Genero],
      ['Condición', P.Condicion], ['Garantía', P.Garantia], ['SKU', P.SKU]
    ].filter(function (r) { return r[1]; });

    return '<div class="pdp-tabs">' +
      '<div class="tab-btns">' +
        '<button class="active" data-tab="desc">Descripción</button>' +
        (carac ? '<button data-tab="carac">Características</button>' : '') +
        '<button data-tab="ficha">Ficha técnica</button>' +
      '</div>' +
      '<div class="tab-pane active" data-pane="desc">' +
        (P.DescripcionLargaHTML || '<p class="muted">Sin descripción adicional.</p>') + '</div>' +
      (carac ? '<div class="tab-pane" data-pane="carac">' + carac + '</div>' : '') +
      '<div class="tab-pane" data-pane="ficha"><table><tbody>' +
        ficha.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
    '</div>';
  }

  function caracteristicasHTML(txt) {
    if (!txt) return '';
    if (/<\w+/.test(txt)) return txt; // ya es HTML
    var lineas = String(txt).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lineas.length) return '';
    if (lineas.some(function (l) { return l.indexOf(':') !== -1; })) {
      return '<table><tbody>' + lineas.map(function (l) {
        var i = l.indexOf(':');
        return i !== -1
          ? '<tr><td>' + esc(l.slice(0, i).trim()) + '</td><td>' + esc(l.slice(i + 1).trim()) + '</td></tr>'
          : '<tr><td colspan="2">' + esc(l) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    return '<ul>' + lineas.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
  }

  function wire() {
    var pdp = document.getElementById('pdp');

    pdp.querySelectorAll('.thumbs img').forEach(function (im) {
      im.addEventListener('click', function () {
        document.getElementById('mainImg').src = im.getAttribute('data-g');
        pdp.querySelectorAll('.thumbs img').forEach(function (x) { x.classList.remove('sel'); });
        im.classList.add('sel');
      });
    });

    pdp.querySelectorAll('[data-color]').forEach(function (b) {
      b.addEventListener('click', function () {
        sel.color = b.getAttribute('data-color');
        pdp.querySelectorAll('[data-color]').forEach(function (x) { x.classList.toggle('sel', x === b); });
        refreshVariantAvailability();
        updateStockNote();
      });
    });
    pdp.querySelectorAll('[data-talle]').forEach(function (b) {
      b.addEventListener('click', function () {
        sel.talle = b.getAttribute('data-talle');
        pdp.querySelectorAll('[data-talle]').forEach(function (x) { x.classList.toggle('sel', x === b); });
        refreshVariantAvailability();
        updateStockNote();
      });
    });

    var qty = document.getElementById('qtyInput');
    pdp.querySelectorAll('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        qty.value = Math.max(1, (parseInt(qty.value, 10) || 1) + parseInt(b.getAttribute('data-q'), 10));
        updateStockNote();
      });
    });
    qty.addEventListener('change', updateStockNote);

    document.getElementById('addBtn').addEventListener('click', addToCart);

    pdp.querySelectorAll('.tab-btns button').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        pdp.querySelectorAll('.tab-btns button').forEach(function (x) { x.classList.toggle('active', x === b); });
        pdp.querySelectorAll('.tab-pane').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-pane') === t);
        });
      });
    });

    refreshVariantAvailability();
  }

  /** Deshabilita combinaciones sin stock. */
  function refreshVariantAvailability() {
    var pdp = document.getElementById('pdp');
    var vs = variantes();
    pdp.querySelectorAll('[data-talle]').forEach(function (b) {
      var t = b.getAttribute('data-talle');
      var hay = vs.some(function (v) {
        return String(v.Talle) === String(t) && Number(v.Stock) > 0 &&
          (!sel.color || String(v.Color) === String(sel.color));
      });
      b.disabled = !hay;
    });
    pdp.querySelectorAll('[data-color]').forEach(function (b) {
      var c = b.getAttribute('data-color');
      var hay = vs.some(function (v) {
        return String(v.Color) === String(c) && Number(v.Stock) > 0 &&
          (!sel.talle || String(v.Talle) === String(sel.talle));
      });
      b.disabled = !hay;
    });
  }

  function updateStockNote() {
    refreshPrecios();
    var note = document.getElementById('stockNote');
    var btn = document.getElementById('addBtn');
    var st = stockDisponible();
    var qty = parseInt(document.getElementById('qtyInput').value, 10) || 1;

    if (st === -1) { note.textContent = 'Elegí color y talle.'; note.className = 'stock-note'; btn.disabled = false; return; }
    if (st <= 0) { note.textContent = 'Sin stock disponible.'; note.className = 'stock-note out'; btn.disabled = true; return; }
    if (qty > st) { note.textContent = 'Solo quedan ' + st + ' unidades.'; note.className = 'stock-note low'; btn.disabled = true; return; }
    if (st <= 5) { note.textContent = '¡Últimas ' + st + ' unidades!'; note.className = 'stock-note low'; }
    else { note.textContent = 'Stock disponible'; note.className = 'stock-note'; }
    btn.disabled = false;
  }

  function addToCart() {
    var qty = Math.max(1, parseInt(document.getElementById('qtyInput').value, 10) || 1);
    var v = null;
    if (tieneVariantes()) {
      v = varianteActual();
      if (!v) { F.ui.toast('Elegí las opciones del producto.', 'error'); return; }
      if (Number(v.Stock) < qty) { F.ui.toast('No hay stock suficiente.', 'error'); return; }
    } else if ((Number(P.StockTotal) || 0) < qty) {
      F.ui.toast('No hay stock suficiente.', 'error'); return;
    }
    var pr = P.precios || {};
    F.Cart.add({
      productoId: P.ID,
      varianteId: v ? v.ID : '',
      cantidad: qty,
      nombre: P.Nombre,
      slug: P.Slug || P.ID,
      precio: pr.precioFinal,
      precioTransferencia: pr.precioTransferencia || pr.precioFinal,
      precioMayorista: pr.tieneMayorista ? pr.precioMayorista : 0,
      precioMayoristaTransferencia: pr.tieneMayorista ? pr.precioMayoristaTransferencia : 0,
      umbralMayorista: pr.tieneMayorista ? pr.umbralMayorista : 0,
      imagen: P.ImagenPrincipalURL || (P.Galeria || [])[0] || '',
      color: v ? v.Color : '',
      talle: v ? v.Talle : '',
      pesoKg: Number(P.PesoKg) || 1,
      envioGratis: !!P.EnvioGratis
    });
    F.ui.toast('Producto agregado al carrito', 'ok');
  }

  function renderSimilares() {
    if (!P.similares || !P.similares.length) return;
    document.getElementById('similaresSection').hidden = false;
    F.render.grid(document.getElementById('similares'), P.similares);
  }

  init();
})(window.FURI = window.FURI || {});
