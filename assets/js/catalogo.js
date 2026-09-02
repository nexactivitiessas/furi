(function (F) {
  'use strict';
  var esc = F.ui.esc;

  var COLOR_MAP = {
    negro: '#111', blanco: '#fff', gris: '#888', rojo: '#e63946', azul: '#1d4ed8',
    verde: '#16a34a', amarillo: '#facc15', naranja: '#f97316', marron: '#78350f',
    marrón: '#78350f', violeta: '#7c3aed', rosa: '#ec4899', celeste: '#38bdf8',
    plata: '#c0c0c0', dorado: '#d4af37', bordo: '#7f1d1d', beige: '#e8dcc0'
  };

  var state = {
    categoria: '', marca: [], colores: [], talles: [], precioMin: '', precioMax: '',
    envioGratis: '', descuentoMin: '', busqueda: '', orden: 'relevancia', pagina: 1,
    atrib: {} // { atributoId: [valores] }
  };

  var refs = {};
  var debounceT = null;

  async function init() {
    await F.ui.renderChrome();
    refs = {
      results: document.getElementById('results'),
      filters: document.getElementById('filters'),
      count: document.getElementById('resultCount'),
      pagination: document.getElementById('pagination'),
      orden: document.getElementById('ordenSelect'),
      title: document.getElementById('catTitle'),
      crumb: document.getElementById('crumb')
    };

    readUrl();
    refs.orden.value = state.orden;
    refs.orden.addEventListener('change', function () { state.orden = refs.orden.value; state.pagina = 1; apply(); });
    document.getElementById('filtersToggle').addEventListener('click', function () {
      refs.filters.classList.toggle('open');
    });

    var data = await Promise.all([
      F.api.get('getCategorias').catch(function () { return []; }),
      F.api.get('getMarcas').catch(function () { return []; }),
      F.api.get('getAtributosFiltro').catch(function () { return []; })
    ]);
    F._cats = data[0]; F._marcas = data[1]; F._atributos = data[2];

    if (state.categoria) {
      var c = F._cats.find(function (x) { return String(x.Slug) === state.categoria || String(x.ID) === state.categoria; });
      if (c) { refs.title.textContent = c.Nombre; refs.crumb.textContent = c.Nombre; }
    } else if (state.busqueda) {
      refs.title.textContent = 'Resultados para "' + state.busqueda + '"';
    }

    buildFilters();
    apply();
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.categoria = p.get('categoria') || '';
    state.busqueda = p.get('busqueda') || '';
    state.orden = p.get('orden') || 'relevancia';
    state.pagina = parseInt(p.get('pagina') || '1', 10) || 1;
    state.precioMin = p.get('precioMin') || '';
    state.precioMax = p.get('precioMax') || '';
    state.envioGratis = p.get('envioGratis') || '';
    state.descuentoMin = p.get('descuentoMin') || '';
    state.marca = p.getAll('marca');
    state.colores = p.getAll('colores');
    state.talles = p.getAll('talles');
    state.atrib = {};
    p.forEach(function (v, k) {
      if (k.indexOf('atrib_') === 0) {
        var id = k.slice(6);
        (state.atrib[id] = state.atrib[id] || []).push(v);
      }
    });
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.categoria) p.set('categoria', state.categoria);
    if (state.busqueda) p.set('busqueda', state.busqueda);
    if (state.orden && state.orden !== 'relevancia') p.set('orden', state.orden);
    if (state.pagina > 1) p.set('pagina', state.pagina);
    if (state.precioMin) p.set('precioMin', state.precioMin);
    if (state.precioMax) p.set('precioMax', state.precioMax);
    if (state.envioGratis) p.set('envioGratis', state.envioGratis);
    if (state.descuentoMin) p.set('descuentoMin', state.descuentoMin);
    state.marca.forEach(function (v) { p.append('marca', v); });
    state.colores.forEach(function (v) { p.append('colores', v); });
    state.talles.forEach(function (v) { p.append('talles', v); });
    Object.keys(state.atrib).forEach(function (id) {
      state.atrib[id].forEach(function (v) { p.append('atrib_' + id, v); });
    });
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : ''));
  }

  function queryParams() {
    var q = {
      categoria: state.categoria, busqueda: state.busqueda, orden: state.orden,
      pagina: state.pagina, porPagina: (F.config && F.config.PRODUCTOS_POR_PAGINA) || 12,
      precioMin: state.precioMin, precioMax: state.precioMax,
      envioGratis: state.envioGratis, descuentoMin: state.descuentoMin,
      marca: state.marca, colores: state.colores, talles: state.talles
    };
    Object.keys(state.atrib).forEach(function (id) {
      if (state.atrib[id].length) q['atrib_' + id] = state.atrib[id];
    });
    return q;
  }

  // ------------------------------------------------------------ Panel filtros
  function buildFilters() {
    var html = '';

    // Categorías (siempre)
    var raiz = F._cats.filter(function (c) { return !c.CategoriaPadreID; });
    if (raiz.length) {
      html += '<div class="fgroup"><h4>Categorías</h4>';
      html += '<label><input type="radio" name="cat" value="" ' + (!state.categoria ? 'checked' : '') + '> Todas</label>';
      raiz.forEach(function (c) {
        html += catRadio(c, 0);
        F._cats.filter(function (h) { return String(h.CategoriaPadreID) === String(c.ID); })
          .forEach(function (h) { html += catRadio(h, 1); });
      });
      html += '</div>';
    }

    (F._atributos || []).forEach(function (a) {
      var nombre = String(a.Nombre).toLowerCase();
      var tipo = String(a.Tipo).toLowerCase();

      if (nombre.indexOf('marca') !== -1) {
        html += '<div class="fgroup"><h4>Marca</h4>' + (F._marcas || []).map(function (m) {
          return '<label><input type="checkbox" data-f="marca" value="' + esc(m.ID) + '" ' +
            (state.marca.indexOf(String(m.ID)) !== -1 ? 'checked' : '') + '> ' + esc(m.Nombre) + '</label>';
        }).join('') + '</div>';

      } else if (tipo === 'rango' || nombre.indexOf('precio') !== -1) {
        html += '<div class="fgroup"><h4>Precio</h4><div class="range-row">' +
          '<input type="number" id="pMin" placeholder="Mín" value="' + esc(state.precioMin) + '">' +
          '<span>–</span>' +
          '<input type="number" id="pMax" placeholder="Máx" value="' + esc(state.precioMax) + '">' +
          '</div><button class="btn btn-sm" id="pApply">Aplicar</button></div>';

      } else if (tipo === 'color' || nombre.indexOf('color') !== -1) {
        html += '<div class="fgroup"><h4>Color</h4><div class="swatches">' +
          (a.Valores || []).map(function (v) {
            var col = COLOR_MAP[String(v).toLowerCase()] || v;
            var sel = state.colores.indexOf(String(v)) !== -1 ? ' sel' : '';
            return '<span class="swatch' + sel + '" title="' + esc(v) + '" data-f="colores" data-v="' + esc(v) +
              '" style="background:' + esc(col) + '"></span>';
          }).join('') + '</div></div>';

      } else if (nombre.indexOf('talle') !== -1) {
        html += '<div class="fgroup"><h4>Talle</h4><div class="chips">' +
          (a.Valores || []).map(function (v) {
            var sel = state.talles.indexOf(String(v)) !== -1 ? ' sel' : '';
            return '<span class="chip' + sel + '" data-f="talles" data-v="' + esc(v) + '">' + esc(v) + '</span>';
          }).join('') + '</div></div>';

      } else if (nombre.indexOf('env') !== -1) {
        html += '<div class="fgroup"><h4>Envío</h4><label><input type="checkbox" id="fEnvio" ' +
          (state.envioGratis ? 'checked' : '') + '> Solo con envío gratis</label></div>';

      } else if (nombre.indexOf('descuento') !== -1) {
        html += '<div class="fgroup"><h4>Descuento</h4>' +
          [10, 20, 30, 50].map(function (d) {
            return '<label><input type="radio" name="desc" value="' + d + '" ' +
              (String(state.descuentoMin) === String(d) ? 'checked' : '') + '> ' + d + '% o más</label>';
          }).join('') +
          '<label><input type="radio" name="desc" value="" ' + (!state.descuentoMin ? 'checked' : '') +
          '> Cualquiera</label></div>';

      } else if (a.Valores && a.Valores.length) {
        // Atributo genérico creado desde el c-panel
        html += '<div class="fgroup"><h4>' + esc(a.Nombre) + '</h4>' + a.Valores.map(function (v) {
          var checked = (state.atrib[a.ID] || []).indexOf(String(v)) !== -1 ? 'checked' : '';
          return '<label><input type="checkbox" data-atrib="' + esc(a.ID) + '" value="' + esc(v) + '" ' +
            checked + '> ' + esc(v) + '</label>';
        }).join('') + '</div>';
      }
    });

    html += '<button class="btn btn-ghost btn-block" id="clearFilters">Limpiar filtros</button>';
    refs.filters.innerHTML = html;
    wireFilters();
  }

  function catRadio(c, lvl) {
    var val = c.Slug || c.ID;
    return '<label style="padding-left:' + (lvl * 14) + 'px"><input type="radio" name="cat" value="' +
      esc(val) + '" ' + (String(state.categoria) === String(val) ? 'checked' : '') + '> ' + esc(c.Nombre) + '</label>';
  }

  function wireFilters() {
    refs.filters.querySelectorAll('input[name="cat"]').forEach(function (r) {
      r.addEventListener('change', function () { state.categoria = r.value; state.pagina = 1; apply(); });
    });
    refs.filters.querySelectorAll('input[data-f="marca"]').forEach(function (c) {
      c.addEventListener('change', function () {
        state.marca = toggleArr(state.marca, c.value, c.checked); state.pagina = 1; apply();
      });
    });
    refs.filters.querySelectorAll('.swatch[data-f="colores"]').forEach(function (s) {
      s.addEventListener('click', function () {
        var v = s.getAttribute('data-v');
        var on = !s.classList.contains('sel');
        s.classList.toggle('sel', on);
        state.colores = toggleArr(state.colores, v, on); state.pagina = 1; apply();
      });
    });
    refs.filters.querySelectorAll('.chip[data-f="talles"]').forEach(function (s) {
      s.addEventListener('click', function () {
        var v = s.getAttribute('data-v');
        var on = !s.classList.contains('sel');
        s.classList.toggle('sel', on);
        state.talles = toggleArr(state.talles, v, on); state.pagina = 1; apply();
      });
    });
    refs.filters.querySelectorAll('input[data-atrib]').forEach(function (c) {
      c.addEventListener('change', function () {
        var id = c.getAttribute('data-atrib');
        state.atrib[id] = toggleArr(state.atrib[id] || [], c.value, c.checked);
        state.pagina = 1; apply();
      });
    });
    var envio = document.getElementById('fEnvio');
    if (envio) envio.addEventListener('change', function () {
      state.envioGratis = envio.checked ? 'true' : ''; state.pagina = 1; apply();
    });
    refs.filters.querySelectorAll('input[name="desc"]').forEach(function (r) {
      r.addEventListener('change', function () { state.descuentoMin = r.value; state.pagina = 1; apply(); });
    });
    var pApply = document.getElementById('pApply');
    if (pApply) pApply.addEventListener('click', function () {
      state.precioMin = document.getElementById('pMin').value;
      state.precioMax = document.getElementById('pMax').value;
      state.pagina = 1; apply();
    });
    document.getElementById('clearFilters').addEventListener('click', function () {
      state = { categoria: '', marca: [], colores: [], talles: [], precioMin: '', precioMax: '',
        envioGratis: '', descuentoMin: '', busqueda: state.busqueda, orden: state.orden, pagina: 1, atrib: {} };
      buildFilters(); apply();
    });
  }

  function toggleArr(arr, val, on) {
    arr = arr.filter(function (x) { return String(x) !== String(val); });
    if (on) arr.push(String(val));
    return arr;
  }

  // ---------------------------------------------------------------- Fetch
  function apply() {
    writeUrl();
    F.ui.loading(refs.results, 'Buscando...');
    clearTimeout(debounceT);
    debounceT = setTimeout(fetchNow, 120);
  }

  async function fetchNow() {
    try {
      var r = await F.api.get('getProductos', queryParams());
      F.render.grid(refs.results, r.items, 'No encontramos productos con esos filtros.');
      refs.count.textContent = r.total + ' producto' + (r.total === 1 ? '' : 's');
      renderPagination(r.pagina, r.paginas);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      F.ui.errorBox(refs.results, e.message);
      refs.count.textContent = '';
      refs.pagination.innerHTML = '';
    }
  }

  function renderPagination(actual, total) {
    if (total <= 1) { refs.pagination.innerHTML = ''; return; }
    var html = '';
    html += '<button ' + (actual <= 1 ? 'disabled' : '') + ' data-p="' + (actual - 1) + '">‹</button>';
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - actual) <= 2) {
        html += '<button class="' + (i === actual ? 'active' : '') + '" data-p="' + i + '">' + i + '</button>';
      } else if (i === actual - 3 || i === actual + 3) {
        html += '<span style="padding:9px 4px">…</span>';
      }
    }
    html += '<button ' + (actual >= total ? 'disabled' : '') + ' data-p="' + (actual + 1) + '">›</button>';
    refs.pagination.innerHTML = html;
    refs.pagination.querySelectorAll('button[data-p]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.pagina = parseInt(b.getAttribute('data-p'), 10);
        apply();
      });
    });
  }

  init();
})(window.FURI = window.FURI || {});
