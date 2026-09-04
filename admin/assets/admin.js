/* =========================================================================
   TIENDA FURI — C-Panel (SPA con hash routing). Consume la misma API.
   ========================================================================= */
(function () {
  'use strict';
  var F = window.FURI || {};
  var SES_KEY = 'furi_admin_v1';

  // ------------------------------------------------------------------ Sesión
  // Usa localStorage cuando se puede; si el navegador lo bloquea (modo privado,
  // escudos de privacidad, cookies deshabilitadas) cae a memoria: la sesión dura
  // hasta que se cierre la pestaña, pero el login NO falla en silencio.
  var _memSession = null;
  var Session = {
    get: function () {
      try {
        var raw = localStorage.getItem(SES_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return _memSession;
    },
    set: function (v) {
      _memSession = v;
      try { localStorage.setItem(SES_KEY, JSON.stringify(v)); } catch (e) {}
    },
    clear: function () {
      _memSession = null;
      try { localStorage.removeItem(SES_KEY); } catch (e) {}
    },
    token: function () { var s = this.get(); return s && s.token; },
    valido: function () { var s = this.get(); return s && s.token && (!s.expira || s.expira > Date.now()); },
    esSuper: function () { var s = this.get(); return s && String(s.rol).toLowerCase() === 'superadmin'; }
  };

  // --------------------------------------------------------------- Helpers API
  function aget(action, params) { return F.api.get(action, params); }
  function apost(action, body) {
    return F.api.post(action, Object.assign({ token: Session.token() }, body || {}))
      .catch(function (e) {
        if (/sesión|expirada|inválida/i.test(e.message)) { Session.clear(); location.reload(); }
        throw e;
      });
  }

  // --------------------------------------------------------------- Utilidades DOM
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var v = Math.abs(Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2).split('.');
    return (Number(n) < 0 ? '-$ ' : '$ ') + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + v[1];
  }
  function bool(v) {
    if (v === true) return true;
    var s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'x';
  }
  function fecha(d) { try { return new Date(d).toLocaleString('es-AR'); } catch (e) { return d || ''; } }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function view() { return document.getElementById('view'); }

  function toast(msg, tipo) {
    var t = document.createElement('div');
    t.className = 'toast ' + (tipo || '');
    t.textContent = msg;
    document.getElementById('toastRoot').appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3400);
  }

  function confirmar(msg) { return window.confirm(msg); }

  // ------------------------------------------------------------------- Modal
  function modal(titulo, bodyHTML, onSave, opts) {
    opts = opts || {};
    var root = document.getElementById('modalRoot');
    root.innerHTML =
      '<div class="modal-bg"><div class="modal">' +
        '<div class="modal-head"><h3>' + esc(titulo) + '</h3><button data-close>&times;</button></div>' +
        '<div class="modal-body">' + bodyHTML + '</div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-ghost" data-close>Cancelar</button>' +
          (onSave ? '<button class="btn" data-save>' + esc(opts.saveLabel || 'Guardar') + '</button>' : '') +
        '</div>' +
      '</div></div>';
    var bg = $('.modal-bg', root);
    function close() { root.innerHTML = ''; }
    root.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
    bg.onclick = function (e) { if (e.target === bg) close(); };
    var saveBtn = root.querySelector('[data-save]');
    if (saveBtn) saveBtn.onclick = async function () {
      saveBtn.disabled = true;
      try { await onSave($('.modal-body', root), close); }
      catch (err) { toast(err.message, 'error'); saveBtn.disabled = false; }
    };
    return { close: close, root: root };
  }

  // --------------------------------------------------- Constructor de formularios
  /**
   * campos: [{ name, label, type, options, hint, cols }]
   * type: text|number|textarea|checkbox|select|image|htmlarea
   */
  function formHTML(campos, data) {
    data = data || {};
    return '<div class="grid-2">' + campos.map(function (c) {
      var v = data[c.name];
      var full = c.cols === 2 || c.type === 'textarea' || c.type === 'htmlarea' ? ' style="grid-column:1/-1"' : '';
      var inner;
      if (c.type === 'checkbox') {
        inner = '<div class="checkbox-row"><input type="checkbox" data-f="' + c.name + '" ' +
          (bool(v) ? 'checked' : '') + '> <span>' + esc(c.label) + '</span></div>';
        return '<div class="field"' + full + '>' + inner + (c.hint ? '<span class="hint">' + esc(c.hint) + '</span>' : '') + '</div>';
      } else if (c.type === 'select') {
        inner = '<select data-f="' + c.name + '">' +
          (c.options || []).map(function (o) {
            var val = o.value !== undefined ? o.value : o;
            var lab = o.label !== undefined ? o.label : o;
            return '<option value="' + esc(val) + '" ' + (String(v) === String(val) ? 'selected' : '') + '>' + esc(lab) + '</option>';
          }).join('') + '</select>';
      } else if (c.type === 'textarea' || c.type === 'htmlarea') {
        inner = '<textarea data-f="' + c.name + '" rows="' + (c.rows || 4) + '">' + esc(v || '') + '</textarea>';
      } else if (c.type === 'image') {
        inner = '<div class="inline"><input type="text" data-f="' + c.name + '" value="' + esc(v || '') + '" placeholder="URL de la imagen">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-upload="' + c.name + '">Subir</button></div>' +
          (v ? '<img src="' + esc(v) + '" style="max-height:70px;margin-top:6px;border:1px solid var(--line);border-radius:6px">' : '');
      } else {
        inner = '<input type="' + (c.type || 'text') + '" data-f="' + c.name + '" value="' + esc(v == null ? '' : v) + '">';
      }
      return '<div class="field"' + full + '><label>' + esc(c.label) + '</label>' + inner +
        (c.hint ? '<span class="hint">' + esc(c.hint) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function collectForm(bodyEl, campos) {
    var out = {};
    campos.forEach(function (c) {
      var el = bodyEl.querySelector('[data-f="' + c.name + '"]');
      if (!el) return;
      if (c.type === 'checkbox') out[c.name] = el.checked;
      else if (c.type === 'number') out[c.name] = el.value === '' ? '' : Number(el.value);
      else out[c.name] = el.value;
    });
    return out;
  }

  function wireUploads(bodyEl) {
    bodyEl.querySelectorAll('[data-upload]').forEach(function (btn) {
      btn.onclick = function () {
        var target = bodyEl.querySelector('[data-f="' + btn.getAttribute('data-upload') + '"]');
        pickAndUpload(function (url) {
          target.value = url;
          toast('Imagen subida', 'ok');
        });
      };
    });
  }

  function pickAndUpload(cb) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var file = inp.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = async function () {
        toast('Subiendo ' + file.name + '…');
        try {
          var r = await apost('uploadImage', {
            archivo: { nombre: file.name, mimeType: file.type, dataBase64: reader.result }
          });
          cb(r.url, r);
        } catch (e) { toast(e.message, 'error'); }
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  // =======================================================================
  // CRUD GENÉRICO (para hojas simples)
  // =======================================================================
  /**
   * cfg: { hoja, titulo, singular, columnas:[{key,label,fmt}], campos, orden(key) }
   */
  function crudSection(cfg) {
    return async function () {
      var v = view();
      v.innerHTML = '<div class="loading">Cargando ' + esc(cfg.titulo) + '…</div>';
      var res = await apost('adminList', { hoja: cfg.hoja });
      var rows = res.data || [];
      if (cfg.orden) rows.sort(function (a, b) { return Number(a[cfg.orden] || 0) - Number(b[cfg.orden] || 0); });

      v.innerHTML =
        '<div class="page-head"><h2>' + esc(cfg.titulo) + '</h2>' +
          '<button class="btn" id="nuevoBtn">+ ' + esc(cfg.singular || 'Nuevo') + '</button></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr>' +
          cfg.columnas.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
          '<th></th></tr></thead><tbody>' +
          (rows.length ? rows.map(function (row) {
            return '<tr>' + cfg.columnas.map(function (c) {
              var val = c.fmt ? c.fmt(row[c.key], row) : esc(row[c.key]);
              return '<td>' + val + '</td>';
            }).join('') +
            '<td class="actions-col">' +
              '<button class="btn btn-ghost btn-sm" data-edit="' + esc(row.ID) + '">Editar</button>' +
              '<button class="btn btn-danger btn-sm" data-del="' + esc(row.ID) + '">Borrar</button>' +
            '</td></tr>';
          }).join('') : '<tr><td colspan="' + (cfg.columnas.length + 1) + '" class="muted" style="text-align:center;padding:30px">Sin registros.</td></tr>') +
        '</tbody></table></div>';

      $('#nuevoBtn').onclick = function () { editar({}); };
      v.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function () { editar(rows.find(function (r) { return String(r.ID) === b.getAttribute('data-edit'); })); };
      });
      v.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = async function () {
          if (!confirmar('¿Borrar este registro? Esta acción no se puede deshacer.')) return;
          try {
            await apost('deleteGenerico', { hoja: cfg.hoja, id: b.getAttribute('data-del') });
            toast('Registro borrado', 'ok'); crudSection(cfg)();
          } catch (e) { toast(e.message, 'error'); }
        };
      });

      async function editar(data) {
        var campos = typeof cfg.campos === 'function' ? await cfg.campos() : cfg.campos;
        var m = modal((data.ID ? 'Editar ' : 'Nuevo ') + (cfg.singular || cfg.hoja).toLowerCase(),
          formHTML(campos, data), async function (bodyEl, close) {
            var rec = collectForm(bodyEl, campos);
            if (data.ID) rec.ID = data.ID;
            await apost('saveGenerico', { hoja: cfg.hoja, registro: rec });
            toast('Guardado', 'ok'); close(); crudSection(cfg)();
          });
        wireUploads(m.root);
      }
    };
  }

  // =======================================================================
  // SECCIONES A MEDIDA
  // =======================================================================

  // ---- Dashboard ----
  async function dashboard() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando dashboard…</div>';
    var r = await apost('getDashboard');
    var d = r.data || {};
    v.innerHTML =
      '<div class="page-head"><h2>Dashboard</h2></div>' +
      '<div class="grid-4">' +
        statCard(money(d.ventasMes), 'Ventas del mes (' + (d.pedidosMes || 0) + ' pedidos aprobados)') +
        statCard(d.pedidosPendientes || 0, 'Pedidos con pago pendiente') +
        statCard(d.coordinacionesPendientes || 0, 'Entregas por coordinar') +
        statCard(d.leadsSinResponder || 0, 'Consultas sin responder') +
      '</div>' +
      '<div class="card"><h3>Stock bajo (≤ 3 u.)</h3>' +
        (d.stockBajo && d.stockBajo.length
          ? '<div class="table-wrap"><table class="data"><thead><tr><th>Producto</th><th>Color</th><th>Talle</th><th>Stock</th></tr></thead><tbody>' +
            d.stockBajo.map(function (s) {
              return '<tr><td>' + esc(s.ProductoID) + '</td><td>' + esc(s.Color) + '</td><td>' + esc(s.Talle) +
                '</td><td><span class="pill ' + (Number(s.Stock) <= 0 ? 'rechazado' : 'pendiente') + '">' + s.Stock + '</span></td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<p class="muted">Todo el stock está en niveles normales.</p>') +
      '</div>';
    function statCard(b, s) { return '<div class="stat-card"><b>' + esc(b) + '</b><span>' + esc(s) + '</span></div>'; }
  }

  // ---- Datos de la tienda (Configuracion) ----
  async function tienda() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando configuración…</div>';
    var cfg = await aget('getConfiguracion');
    var campos = [
      { name: 'NombreTienda', label: 'Nombre de la tienda' },
      { name: 'Email', label: 'Email de contacto', type: 'email' },
      { name: 'Telefono', label: 'Teléfono' },
      { name: 'WhatsApp', label: 'WhatsApp (solo números, con código país)', hint: 'Ej: 5493511234567' },
      { name: 'Direccion', label: 'Dirección', cols: 2 },
      { name: 'LogoURL', label: 'Logo', type: 'image' },
      { name: 'FaviconURL', label: 'Favicon', type: 'image' },
      { name: 'BannerPrincipalURL', label: 'Banner del home', type: 'image' },
      { name: 'TextoBannerSuperior', label: 'Texto de la barra superior', cols: 2 },
      { name: 'ColorPrimario', label: 'Color primario', hint: 'Hex, ej: #e11d48' },
      { name: 'ColorSecundario', label: 'Color secundario', hint: 'Hex' },
      { name: 'MontoEnvioGratisDesde', label: 'Envío gratis desde ($)', type: 'number' },
      { name: 'CantidadMayoristaDefault', label: 'Cantidad para precio mayorista (global)', type: 'number', hint: '0 = desactivado. Umbral por defecto para productos sin cantidad propia; también aplica al total de unidades del carrito.' },
      { name: 'MP_PublicKey', label: 'Mercado Pago · Public Key', hint: 'Es pública. El Access Token va en Script Properties.' },
      { name: 'MonedaSimbolo', label: 'Símbolo de moneda' },
      { name: 'IVA_Default', label: 'IVA por defecto (%)', type: 'number' },
      { name: 'Instagram', label: 'Instagram (URL)' },
      { name: 'Facebook', label: 'Facebook (URL)' },
      { name: 'TikTok', label: 'TikTok (URL)' },
      { name: 'YouTube', label: 'YouTube (URL)' },
      { name: 'LinkedIn', label: 'LinkedIn (URL)' },
      { name: 'SobreNosotrosHTML', label: 'Sobre nosotros (HTML)', type: 'htmlarea', rows: 5, cols: 2 },
      { name: 'TextoFooterLegal', label: 'Texto legal del footer', cols: 2 }
    ];
    v.innerHTML = '<div class="page-head"><h2>Datos de la tienda</h2></div><div class="card" id="cfgCard"></div>';
    var card = $('#cfgCard');
    card.innerHTML = formHTML(campos, cfg) + '<button class="btn" id="saveCfg">Guardar cambios</button>';
    wireUploads(card);
    $('#saveCfg').onclick = async function () {
      var btn = this; btn.disabled = true;
      try {
        await apost('updateConfiguracion', { datos: collectForm(card, campos) });
        toast('Configuración guardada', 'ok');
      } catch (e) { toast(e.message, 'error'); }
      btn.disabled = false;
    };
  }

  // ---- Productos ----
  async function productos() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando productos…</div>';
    var data = await Promise.all([
      apost('adminList', { hoja: 'Productos' }),
      apost('adminList', { hoja: 'Categorias' }),
      apost('adminList', { hoja: 'Marcas' })
    ]);
    var rows = data[0].data || [], cats = data[1].data || [], marcas = data[2].data || [];
    var catOpts = [{ value: '', label: '— sin categoría —' }].concat(cats.map(function (c) { return { value: c.ID, label: c.Nombre }; }));
    var marcaOpts = [{ value: '', label: '— sin marca —' }].concat(marcas.map(function (m) { return { value: m.ID, label: m.Nombre }; }));
    var catName = {}; cats.forEach(function (c) { catName[c.ID] = c.Nombre; });

    v.innerHTML =
      '<div class="page-head"><h2>Productos</h2><button class="btn" id="nuevoBtn">+ Producto</button></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Nombre</th><th>SKU</th><th>Categoría</th><th>Costo</th><th>Minorista</th><th>Mayorista</th><th>Stock</th><th>Estado</th><th></th>' +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (p) {
        var costo = Number(p.PrecioCosto) || 0, mMin = Number(p.MargenMinorista) || 0, mMay = Number(p.MargenMayorista) || 0;
        var listaManual = Number(p.PrecioLista) || 0;
        var minorista = costo > 0 ? (listaManual > 0 ? listaManual : Math.round(costo * (1 + mMin / 100))) : listaManual;
        var mayorista = (costo > 0 && mMay > 0) ? Math.round(costo * (1 + mMay / 100)) : 0;
        return '<tr>' +
          '<td>' + esc(p.Nombre) + (bool(p.Destacado) ? ' ⭐' : '') + '</td>' +
          '<td>' + esc(p.SKU) + '</td>' +
          '<td>' + esc(catName[p.CategoriaID] || '') + '</td>' +
          '<td>' + (costo > 0 ? money(costo) : '—') + '</td>' +
          '<td>' + (minorista > 0 ? money(minorista) : '—') + (Number(p.PorcentajeDescuento) ? ' <span class="muted">-' + p.PorcentajeDescuento + '%</span>' : '') + '</td>' +
          '<td>' + (mayorista > 0 ? money(mayorista) : '<span class="muted">—</span>') + '</td>' +
          '<td>' + esc(p.StockTotal || 0) + '</td>' +
          '<td><span class="pill ' + (bool(p.Activo) ? 'aprobado' : 'gris') + '">' + (bool(p.Activo) ? 'activo' : 'inactivo') + '</span></td>' +
          '<td class="actions-col">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + esc(p.ID) + '">Editar</button>' +
            '<button class="btn btn-danger btn-sm" data-del="' + esc(p.ID) + '">Borrar</button>' +
          '</td></tr>';
      }).join('') : '<tr><td colspan="9" class="muted" style="text-align:center;padding:30px">Sin productos.</td></tr>') +
      '</tbody></table></div>';

    $('#nuevoBtn').onclick = function () { editarProducto({}); };
    v.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () { editarProducto(rows.find(function (r) { return String(r.ID) === b.getAttribute('data-edit'); })); };
    });
    v.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirmar('¿Borrar el producto y todas sus variantes/atributos?')) return;
        try { await apost('deleteGenerico', { hoja: 'Productos', id: b.getAttribute('data-del') }); toast('Producto borrado', 'ok'); productos(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });

    function editarProducto(p) {
      var campos = [
        { name: 'Nombre', label: 'Nombre', cols: 2 },
        { name: 'SKU', label: 'SKU' },
        { name: 'Slug', label: 'Slug (se genera solo si lo dejás vacío)' },
        { name: 'CategoriaID', label: 'Categoría', type: 'select', options: catOpts },
        { name: 'MarcaID', label: 'Marca', type: 'select', options: marcaOpts },
        { name: 'DescripcionCorta', label: 'Descripción corta', cols: 2 },
        { name: 'DescripcionLargaHTML', label: 'Descripción larga (HTML)', type: 'htmlarea', rows: 5, cols: 2 },
        { name: 'CaracteristicasAdicionales', label: 'Características (una por línea, "clave: valor")', type: 'textarea', cols: 2 },
        { name: 'PrecioCosto', label: 'Precio de costo (proveedor)', type: 'number', hint: 'Si lo cargás, los precios se calculan con los márgenes de abajo.' },
        { name: 'MargenMinorista', label: '% Incremento minorista', type: 'number', hint: 'Sobre el costo. Ej: 60 = costo + 60%.' },
        { name: 'MargenMayorista', label: '% Incremento mayorista', type: 'number', hint: 'Menor que el minorista. Vacío/0 = no hay precio mayorista.' },
        { name: 'CantidadMayorista', label: 'Cantidad mínima mayorista', type: 'number', hint: '0 = usar el valor global de "Datos de la tienda".' },
        { name: 'PrecioLista', label: 'Precio de lista (override manual)', type: 'number', hint: 'Vacío = se calcula desde costo + % minorista. Si lo cargás, este manda.' },
        { name: 'PorcentajeDescuento', label: '% Descuento', type: 'number' },
        { name: 'PorcentajeDescuentoTransferencia', label: '% Descuento transferencia', type: 'number' },
        { name: 'CuotasCantidad', label: 'Cantidad de cuotas', type: 'number' },
        { name: 'PesoKg', label: 'Peso (kg) — para Andreani', type: 'number' },
        { name: 'StockTotal', label: 'Stock total (si no usa variantes)', type: 'number' },
        { name: 'Genero', label: 'Género' },
        { name: 'Condicion', label: 'Condición' },
        { name: 'Garantia', label: 'Garantía' },
        { name: 'Ordenamiento', label: 'Orden', type: 'number' },
        { name: 'ImagenPrincipalURL', label: 'Imagen principal', type: 'image' },
        { name: 'GaleriaURLs', label: 'Galería (una URL por línea)', type: 'textarea', cols: 2 },
        { name: 'CuotasSinInteres', label: 'Cuotas sin interés', type: 'checkbox' },
        { name: 'EnvioGratis', label: 'Envío gratis', type: 'checkbox' },
        { name: 'Destacado', label: 'Destacado en el home', type: 'checkbox' },
        { name: 'Activo', label: 'Activo (visible en la tienda)', type: 'checkbox' }
      ];
      var dataForm = Object.assign({}, p);
      // Tolerante a datos viejos separados por "|", coma o espacio: siempre los repone uno por línea.
      dataForm.GaleriaURLs = String(p.GaleriaURLs || '').split(/[|,\s]+/).filter(Boolean).join('\n');
      if (!p.ID) dataForm.Activo = true;

      var extra =
        '<div id="precioCalc" class="card" style="margin-top:14px;background:#fafbfc"></div>' +
        (p.ID
          ? '<hr style="margin:22px 0"><div id="varBox"></div><hr style="margin:22px 0"><div id="atrBox"></div>'
          : '<p class="hint" style="margin-top:14px">Guardá el producto para poder cargarle variantes (color/talle) y atributos de filtro.</p>');

      var m = modal((p.ID ? 'Editar' : 'Nuevo') + ' producto', formHTML(campos, dataForm) + extra,
        async function (bodyEl, close) {
          var rec = collectForm(bodyEl, campos);
          // Acepta una URL por línea (lo normal) o pegadas con espacios/coma: separa por cualquiera de los tres.
          rec.GaleriaURLs = String(rec.GaleriaURLs || '').split(/[\s,]+/).filter(Boolean).join(' | ');
          if (p.ID) rec.ID = p.ID;
          if (!p.ID) rec.FechaAlta = new Date().toISOString();
          var r = await apost('saveGenerico', { hoja: 'Productos', registro: rec });
          toast('Producto guardado', 'ok'); close();
          productos();
        }, { saveLabel: 'Guardar producto' });
      wireUploads(m.root);

      // --- Vista previa de precios calculados, en vivo ---
      function recalcPreview() {
        var g = function (n) { var e = m.root.querySelector('[data-f="' + n + '"]'); return e ? Number(e.value) || 0 : 0; };
        var costo = g('PrecioCosto'), mMin = g('MargenMinorista'), mMay = g('MargenMayorista');
        var listaManual = g('PrecioLista'), desc = g('PorcentajeDescuento'), descT = g('PorcentajeDescuentoTransferencia');
        var umbralProd = g('CantidadMayorista');
        var box = m.root.querySelector('#precioCalc');
        if (!costo && !listaManual) { box.innerHTML = '<span class="muted">Cargá un precio de costo o un precio de lista.</span>'; return; }
        var minBase = costo > 0 ? (listaManual > 0 ? listaManual : Math.round(costo * (1 + mMin / 100))) : listaManual;
        var minFinal = Math.round(minBase * (1 - desc / 100));
        var html = '<b>Precio minorista:</b> ' + money(minFinal) +
          (desc ? ' <span class="muted">(lista ' + money(minBase) + ' − ' + desc + '%)</span>' : '') +
          (descT ? ' · transferencia ' + money(Math.round(minFinal * (1 - descT / 100))) : '');
        if (costo > 0 && mMay > 0) {
          var mayBase = Math.round(costo * (1 + mMay / 100));
          var mayFinal = Math.round(mayBase * (1 - desc / 100));
          html += '<br><b style="color:var(--ok)">Precio mayorista:</b> ' + money(mayFinal) +
            ' <span class="muted">a partir de ' + (umbralProd || 'N (global)') + ' u.</span>';
        } else if (costo > 0) {
          html += '<br><span class="muted">Sin precio mayorista (falta % incremento mayorista).</span>';
        }
        box.innerHTML = html;
      }
      ['PrecioCosto', 'MargenMinorista', 'MargenMayorista', 'PrecioLista', 'PorcentajeDescuento', 'PorcentajeDescuentoTransferencia', 'CantidadMayorista']
        .forEach(function (n) {
          var e = m.root.querySelector('[data-f="' + n + '"]');
          if (e) e.addEventListener('input', recalcPreview);
        });
      recalcPreview();

      if (p.ID) { renderVariantes(m.root.querySelector('#varBox'), p.ID); renderAtributos(m.root.querySelector('#atrBox'), p.ID); }
    }

    async function renderVariantes(box, productoId) {
      box.innerHTML = '<h3>Variantes (color / talle)</h3><div class="loading">Cargando…</div>';
      var all = (await apost('adminList', { hoja: 'Variantes' })).data || [];
      var vs = all.filter(function (x) { return String(x.ProductoID) === String(productoId); });
      box.innerHTML = '<h3>Variantes (color / talle)</h3>' +
        '<div id="varRows">' + vs.map(varRow).join('') + '</div>' +
        '<button class="btn btn-ghost btn-sm" id="addVar">+ Agregar variante</button>';
      function varRow(x) {
        x = x || {};
        return '<div class="repeater-row" data-id="' + esc(x.ID || '') + '">' +
          inp('Color', 'Color', x.Color) + inp('Talle', 'Talle', x.Talle) +
          inp('SKU', 'SKU_Variante', x.SKU_Variante) + inp('Stock', 'Stock', x.Stock, 'number') +
          inp('Imagen URL', 'ImagenURL', x.ImagenURL) +
          '<button class="btn btn-danger btn-sm" data-save-var>💾</button>' +
        '</div>';
      }
      function inp(label, f, val, type) {
        return '<div class="field"><label>' + label + '</label><input type="' + (type || 'text') + '" data-vf="' + f + '" value="' + esc(val == null ? '' : val) + '"></div>';
      }
      function wireRow(rowEl) {
        rowEl.querySelector('[data-save-var]').onclick = async function () {
          var rec = { ProductoID: productoId };
          rowEl.querySelectorAll('[data-vf]').forEach(function (i) { rec[i.getAttribute('data-vf')] = i.type === 'number' ? Number(i.value) : i.value; });
          var id = rowEl.getAttribute('data-id');
          if (id) rec.ID = id;
          try {
            var r = await apost('saveGenerico', { hoja: 'Variantes', registro: rec });
            if (r.id && !id) rowEl.setAttribute('data-id', r.id);
            toast('Variante guardada', 'ok');
          } catch (e) { toast(e.message, 'error'); }
        };
      }
      box.querySelectorAll('.repeater-row').forEach(wireRow);
      box.querySelector('#addVar').onclick = function () {
        var wrap = document.createElement('div');
        wrap.innerHTML = varRow({});
        var rowEl = wrap.firstChild;
        box.querySelector('#varRows').appendChild(rowEl);
        wireRow(rowEl);
      };
    }

    async function renderAtributos(box, productoId) {
      box.innerHTML = '<h3>Atributos de filtro</h3><div class="loading">Cargando…</div>';
      var data = await Promise.all([
        apost('adminList', { hoja: 'AtributosFiltro' }),
        apost('adminList', { hoja: 'ProductoAtributos' })
      ]);
      var atributos = (data[0].data || []).filter(function (a) { return bool(a.Activo); });
      var asignados = (data[1].data || []).filter(function (x) { return String(x.ProductoID) === String(productoId); });
      box.innerHTML = '<h3>Atributos de filtro</h3><p class="hint">Valor que se usa para filtrar este producto en el catálogo. Vacío = no aplica.</p>' +
        atributos.map(function (a) {
          var actual = asignados.find(function (x) { return String(x.AtributoID) === String(a.ID); });
          return '<div class="field"><label>' + esc(a.Nombre) + ' (' + esc(a.Tipo) + ')</label>' +
            '<div class="inline"><input type="text" data-atr="' + esc(a.ID) + '" data-rowid="' + esc(actual ? actual.ID : '') + '" value="' + esc(actual ? actual.Valor : '') + '">' +
            '<button class="btn btn-ghost btn-sm" data-save-atr="' + esc(a.ID) + '">Guardar</button></div></div>';
        }).join('');
      box.querySelectorAll('[data-save-atr]').forEach(function (btn) {
        btn.onclick = async function () {
          var input = box.querySelector('[data-atr="' + btn.getAttribute('data-save-atr') + '"]');
          var rowId = input.getAttribute('data-rowid');
          try {
            if (!input.value.trim()) {
              if (rowId) { await apost('deleteGenerico', { hoja: 'ProductoAtributos', id: rowId }); input.setAttribute('data-rowid', ''); }
              toast('Atributo quitado', 'ok'); return;
            }
            var rec = { ProductoID: productoId, AtributoID: btn.getAttribute('data-save-atr'), Valor: input.value.trim() };
            if (rowId) rec.ID = rowId;
            var r = await apost('saveGenerico', { hoja: 'ProductoAtributos', registro: rec });
            if (r.id && !rowId) input.setAttribute('data-rowid', r.id);
            toast('Atributo guardado', 'ok');
          } catch (e) { toast(e.message, 'error'); }
        };
      });
    }
  }

  // ---- Imágenes ----
  async function imagenes() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando galería…</div>';
    var r = await apost('listImages');
    var imgs = r.data || [];
    v.innerHTML =
      '<div class="page-head"><h2>Imágenes</h2><button class="btn" id="subirBtn">+ Subir imagen</button></div>' +
      '<p class="muted">Las imágenes se guardan en el repo de GitHub. No se pueden borrar si están en uso.</p>' +
      '<div class="img-grid">' + (imgs.length ? imgs.map(function (im) {
        return '<div class="img-tile"><img src="' + esc(im.URLPublica) + '" alt="">' +
          '<div class="meta">' + esc(im.NombreOriginal) + '<br>' + (im.TamanioKB || '?') + ' KB · ' + esc(im.FechaSubida) +
          '<br><span class="copy-url" data-copy="' + esc(im.URLPublica) + '">copiar URL</span>' +
          '<br><button class="btn btn-danger btn-sm" data-del="' + esc(im.ID) + '">Borrar</button></div></div>';
      }).join('') : '<p class="muted">Todavía no subiste imágenes.</p>') + '</div>';

    $('#subirBtn').onclick = function () { pickAndUpload(function () { toast('Imagen subida', 'ok'); imagenes(); }); };
    v.querySelectorAll('[data-copy]').forEach(function (s) {
      s.onclick = function () { navigator.clipboard.writeText(s.getAttribute('data-copy')); toast('URL copiada', 'ok'); };
    });
    v.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirmar('¿Borrar esta imagen del repositorio?')) return;
        try { await apost('deleteImage', { id: b.getAttribute('data-del') }); toast('Imagen borrada', 'ok'); imagenes(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  // ---- Pedidos ----
  async function pedidos() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando pedidos…</div>';
    var estadoPago = '', estadoCoord = '';
    await pintar();

    async function pintar() {
      var r = await apost('getPedidos', { filtros: { estadoPago: estadoPago, estadoCoordinacion: estadoCoord } });
      var rows = r.data || [];
      v.innerHTML =
        '<div class="page-head"><h2>Pedidos</h2></div>' +
        '<div class="filters-bar">' +
          selectF('estadoPago', 'Estado de pago', ['', 'pendiente', 'aprobado', 'rechazado', 'reembolsado'], estadoPago) +
          selectF('estadoCoord', 'Coordinación', ['', 'pendiente', 'contactado', 'acordado', 'entregado', 'n/a'], estadoCoord) +
        '</div>' +
        '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>#</th><th>Fecha</th><th>Cliente</th><th>Envío</th><th>Total</th><th>Pago</th><th>Coordinación</th><th></th>' +
        '</tr></thead><tbody>' +
        (rows.length ? rows.map(function (p) {
          return '<tr>' +
            '<td>' + esc(String(p.ID).slice(0, 8).toUpperCase()) + '</td>' +
            '<td>' + fecha(p.Fecha) + '</td>' +
            '<td>' + esc(p.ClienteNombre) + '<br><span class="muted" style="font-size:.8rem">' + esc(p.ClienteEmail) + '</span></td>' +
            '<td>' + esc(p.MetodoEnvioNombre) + '</td>' +
            '<td>' + money(p.Total) + '</td>' +
            '<td><span class="pill ' + esc(p.EstadoPago) + '">' + esc(p.EstadoPago) + '</span></td>' +
            '<td>' + (bool(p.RequiereCoordinacion) ? '<span class="pill ' + esc(p.EstadoCoordinacion) + '">' + esc(p.EstadoCoordinacion) + '</span>' : '<span class="muted">—</span>') + '</td>' +
            '<td class="actions-col"><button class="btn btn-ghost btn-sm" data-ver="' + esc(p.ID) + '">Ver</button></td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="8" class="muted" style="text-align:center;padding:30px">Sin pedidos.</td></tr>') +
        '</tbody></table></div>';

      $('#f_estadoPago').onchange = function () { estadoPago = this.value; pintar(); };
      $('#f_estadoCoord').onchange = function () { estadoCoord = this.value; pintar(); };
      v.querySelectorAll('[data-ver]').forEach(function (b) {
        b.onclick = function () { verPedido(b.getAttribute('data-ver')); };
      });
    }

    function selectF(id, label, opts, val) {
      return '<label>' + label + ': <select id="f_' + id + '">' + opts.map(function (o) {
        return '<option value="' + o + '" ' + (o === val ? 'selected' : '') + '>' + (o || 'todos') + '</option>';
      }).join('') + '</select></label>';
    }

    async function verPedido(id) {
      var r = await apost('getPedidoDetalle', { id: id });
      var p = r.data.pedido, det = r.data.detalle || [];
      var body =
        '<div class="grid-2">' +
          '<div><b>Cliente</b><br>' + esc(p.ClienteNombre) + '<br>' + esc(p.ClienteEmail) + '<br>' + esc(p.ClienteTelefono || '') + '</div>' +
          '<div><b>Envío</b><br>' + esc(p.MetodoEnvioNombre) + '<br>' + esc(p.DireccionEnvio || '') + ' ' + esc(p.Ciudad || '') +
            ' ' + esc(p.Provincia || '') + ' ' + esc(p.CodigoPostal || '') + '</div>' +
        '</div>' +
        '<table class="data" style="margin-top:14px"><thead><tr><th>Producto</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr></thead><tbody>' +
        det.map(function (d) {
          return '<tr><td>' + esc(d.NombreProducto) + ([d.Color, d.Talle].filter(Boolean).length ? ' (' + esc([d.Color, d.Talle].filter(Boolean).join(' / ')) + ')' : '') +
            (bool(d.EsMayorista) ? ' <span class="pill aprobado">mayorista</span>' : '') +
            '</td><td>' + d.Cantidad + '</td><td>' + money(d.PrecioUnitario) + '</td><td>' + money(d.Subtotal) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<div style="text-align:right;margin-top:10px">Subtotal: ' + money(p.Subtotal) +
          '<br>Descuento: ' + money(p.DescuentoCupon) + (p.CuponCodigo ? ' (' + esc(p.CuponCodigo) + ')' : '') +
          '<br>Envío: ' + money(p.CostoEnvio) +
          '<br><b style="font-size:1.15rem">Total: ' + money(p.Total) + '</b></div>' +
        '<hr style="margin:18px 0">' +
        '<div class="grid-2">' +
          '<div class="field"><label>Estado de pago</label><select data-f="estadoPago">' +
            ['pendiente', 'aprobado', 'rechazado', 'reembolsado'].map(function (o) {
              return '<option ' + (o === p.EstadoPago ? 'selected' : '') + '>' + o + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><label>Estado de coordinación</label><select data-f="estadoCoord">' +
            ['pendiente', 'contactado', 'acordado', 'entregado', 'n/a'].map(function (o) {
              return '<option ' + (o === p.EstadoCoordinacion ? 'selected' : '') + '>' + o + '</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<div class="field"><label>Notas de coordinación</label><textarea data-f="notas" rows="3">' + esc(p.NotasCoordinacion || '') + '</textarea></div>' +
        '<button class="btn btn-ghost btn-sm" data-reenviar>Reenviar factura por email</button>';

      var m = modal('Pedido #' + String(p.ID).slice(0, 8).toUpperCase(), body, async function (bodyEl, close) {
        var nuevoPago = bodyEl.querySelector('[data-f="estadoPago"]').value;
        var nuevoCoord = bodyEl.querySelector('[data-f="estadoCoord"]').value;
        var notas = bodyEl.querySelector('[data-f="notas"]').value;
        if (nuevoPago !== p.EstadoPago) await apost('actualizarEstadoPedido', { id: id, estado: nuevoPago });
        await apost('actualizarCoordinacion', { id: id, estadoCoordinacion: nuevoCoord, notas: notas });
        toast('Pedido actualizado', 'ok'); close(); pintar();
      });
      m.root.querySelector('[data-reenviar]').onclick = async function () {
        try { await apost('reenviarFactura', { pedidoId: id }); toast('Factura reenviada', 'ok'); }
        catch (e) { toast(e.message, 'error'); }
      };
    }
  }

  // ---- Clientes ----
  async function clientes() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando clientes…</div>';
    var r = await apost('getClientes');
    var rows = r.data || [];
    v.innerHTML =
      '<div class="page-head"><h2>Clientes</h2><button class="btn" id="nuevoBtn">+ Cliente</button></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Nombre</th><th>Email</th><th>Teléfono</th><th>Dirección</th><th>Alta</th><th></th>' +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (c) {
        return '<tr><td>' + esc((c.Nombre || '') + ' ' + (c.Apellido || '')) + '</td><td>' + esc(c.Email) + '</td>' +
          '<td>' + esc(c.Telefono || '') + '</td>' +
          '<td>' + esc([c.Direccion, c.Ciudad, c.Provincia, c.CodigoPostal].filter(Boolean).join(', ')) + '</td>' +
          '<td>' + fecha(c.FechaRegistro) + '</td>' +
          '<td class="actions-col"><button class="btn btn-ghost btn-sm" data-edit="' + esc(c.ID) + '">Editar</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">Sin clientes.</td></tr>') +
      '</tbody></table></div>';

    var campos = [
      { name: 'Nombre', label: 'Nombre' }, { name: 'Apellido', label: 'Apellido' },
      { name: 'Email', label: 'Email', type: 'email' }, { name: 'Telefono', label: 'Teléfono' },
      { name: 'DNI_CUIT', label: 'DNI / CUIT' },
      { name: 'Direccion', label: 'Dirección', cols: 2 },
      { name: 'Ciudad', label: 'Ciudad' }, { name: 'Provincia', label: 'Provincia' },
      { name: 'CodigoPostal', label: 'Código postal' },
      { name: 'Password', label: 'Contraseña (dejar vacío para no cambiar)', type: 'text' },
      { name: 'Activo', label: 'Activo', type: 'checkbox' }
    ];
    $('#nuevoBtn').onclick = function () { editar({ Activo: true }); };
    v.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () { editar(rows.find(function (r) { return String(r.ID) === b.getAttribute('data-edit'); })); };
    });
    function editar(c) {
      modal((c.ID ? 'Editar' : 'Nuevo') + ' cliente', formHTML(campos, c), async function (bodyEl, close) {
        var rec = collectForm(bodyEl, campos);
        if (c.ID) rec.ID = c.ID;
        if (!rec.Password) delete rec.Password;
        await apost('guardarClienteAdmin', { cliente: rec });
        toast('Cliente guardado', 'ok'); close(); clientes();
      });
    }
  }

  // ---- Leads ----
  async function leads() {
    var v = view();
    v.innerHTML = '<div class="loading">Cargando consultas…</div>';
    var r = await apost('getLeads');
    var rows = r.data || [];
    v.innerHTML =
      '<div class="page-head"><h2>Consultas / Leads</h2></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Fecha</th><th>Nombre</th><th>Contacto</th><th>Asunto</th><th>Mensaje</th><th>Estado</th><th></th>' +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (l) {
        return '<tr><td>' + fecha(l.Fecha) + '</td><td>' + esc(l.Nombre) + '</td>' +
          '<td>' + esc(l.Email || '') + '<br>' + esc(l.Telefono || '') + '</td>' +
          '<td>' + esc(l.Asunto || '') + '</td><td style="max-width:280px">' + esc(l.Mensaje || '') + '</td>' +
          '<td><span class="pill ' + (String(l.Estado) === 'respondido' ? 'aprobado' : 'pendiente') + '">' + esc(l.Estado || 'nuevo') + '</span></td>' +
          '<td class="actions-col">' +
            (String(l.Estado) !== 'respondido' ? '<button class="btn btn-ghost btn-sm" data-ok="' + esc(l.ID) + '">Marcar respondido</button>' : '') +
            '<button class="btn btn-danger btn-sm" data-del="' + esc(l.ID) + '">Borrar</button>' +
          '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">Sin consultas.</td></tr>') +
      '</tbody></table></div>';
    v.querySelectorAll('[data-ok]').forEach(function (b) {
      b.onclick = async function () {
        try { await apost('saveGenerico', { hoja: 'Leads', registro: { ID: b.getAttribute('data-ok'), Estado: 'respondido' } }); toast('Marcado', 'ok'); leads(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });
    v.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirmar('¿Borrar esta consulta?')) return;
        try { await apost('deleteGenerico', { hoja: 'Leads', id: b.getAttribute('data-del') }); toast('Borrado', 'ok'); leads(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  // ---- Usuarios administradores ----
  async function usuarios() {
    var v = view();
    if (!Session.esSuper()) {
      v.innerHTML = '<div class="page-head"><h2>Administradores</h2></div>' +
        '<div class="card"><p>Solo un <b>superadmin</b> puede gestionar administradores.</p>' + cambiarPassPropia() + '</div>';
      wirePassPropia(v);
      return;
    }
    v.innerHTML = '<div class="loading">Cargando…</div>';
    var r = await apost('getAdmins');
    var rows = r.data || [];
    v.innerHTML =
      '<div class="page-head"><h2>Administradores</h2><button class="btn" id="nuevoBtn">+ Admin</button></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>' +
      rows.map(function (u) {
        return '<tr><td>' + esc(u.Usuario) + '</td><td>' + esc(u.Rol) + '</td>' +
          '<td><span class="pill ' + (u.Activo ? 'aprobado' : 'gris') + '">' + (u.Activo ? 'activo' : 'inactivo') + '</span></td>' +
          '<td class="actions-col">' +
            '<button class="btn btn-ghost btn-sm" data-pass="' + esc(u.ID) + '">Cambiar contraseña</button>' +
            '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(u.ID) + '" data-activo="' + (u.Activo ? '1' : '0') + '">' + (u.Activo ? 'Desactivar' : 'Activar') + '</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card" style="margin-top:20px"><h3>Mi contraseña</h3>' + cambiarPassPropia() + '</div>';

    $('#nuevoBtn').onclick = function () {
      var campos = [
        { name: 'Usuario', label: 'Usuario' },
        { name: 'Password', label: 'Contraseña', type: 'text' },
        { name: 'Rol', label: 'Rol', type: 'select', options: ['admin', 'superadmin'] }
      ];
      modal('Nuevo administrador', formHTML(campos, { Rol: 'admin' }), async function (bodyEl, close) {
        await apost('crearAdmin', { datos: collectForm(bodyEl, campos) });
        toast('Admin creado', 'ok'); close(); usuarios();
      });
    };
    v.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.onclick = async function () {
        try {
          await apost('toggleAdmin', { id: b.getAttribute('data-toggle'), activo: b.getAttribute('data-activo') !== '1' });
          usuarios();
        } catch (e) { toast(e.message, 'error'); }
      };
    });
    v.querySelectorAll('[data-pass]').forEach(function (b) {
      b.onclick = function () {
        var np = prompt('Nueva contraseña para este admin:');
        if (!np) return;
        apost('resetPasswordAdmin', { id: b.getAttribute('data-pass'), nuevaPassword: np })
          .then(function () { toast('Contraseña actualizada', 'ok'); })
          .catch(function (e) { toast(e.message, 'error'); });
      };
    });
    wirePassPropia(v);

    function cambiarPassPropia() {
      return '<div class="field"><label>Usuario nuevo (opcional)</label><input id="ppUser"></div>' +
        '<div class="field"><label>Contraseña nueva</label><input id="ppPass" type="password"></div>' +
        '<button class="btn" id="ppSave">Actualizar mis credenciales</button>';
    }
  }
  function wirePassPropia(v) {
    var btn = v.querySelector('#ppSave');
    if (!btn) return;
    btn.onclick = async function () {
      var u = v.querySelector('#ppUser').value.trim();
      var p = v.querySelector('#ppPass').value;
      if (!u && !p) return;
      try {
        var r = await apost('changeCredentials', { nuevoUsuario: u || undefined, nuevaPassword: p || undefined });
        toast('Credenciales actualizadas. Volvé a iniciar sesión.', 'ok');
        setTimeout(function () { Session.clear(); location.reload(); }, 1500);
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  // =======================================================================
  // REGISTRO DE SECCIONES + ROUTER
  // =======================================================================
  var CATEGORIAS_CAMPOS = function () {
    return apost('adminList', { hoja: 'Categorias' }).then(function (r) {
      var opts = [{ value: '', label: '— sin padre —' }].concat((r.data || []).map(function (c) { return { value: c.ID, label: c.Nombre }; }));
      return [
        { name: 'Nombre', label: 'Nombre' },
        { name: 'Slug', label: 'Slug (auto si vacío)' },
        { name: 'CategoriaPadreID', label: 'Categoría padre', type: 'select', options: opts },
        { name: 'ImagenURL', label: 'Imagen', type: 'image' },
        { name: 'Orden', label: 'Orden', type: 'number' },
        { name: 'Activo', label: 'Activa', type: 'checkbox' }
      ];
    });
  };

  var SECCIONES = [
    { id: 'dashboard', label: 'Dashboard', grupo: '', render: dashboard },
    { id: 'tienda', label: 'Datos de la tienda', grupo: '', render: tienda },

    { id: 'productos', label: 'Productos', grupo: 'Catálogo', render: productos },
    { id: 'categorias', label: 'Categorías', grupo: 'Catálogo', render: crudSection({
        hoja: 'Categorias', titulo: 'Categorías', singular: 'Categoría', orden: 'Orden',
        columnas: [{ key: 'Nombre', label: 'Nombre' }, { key: 'Slug', label: 'Slug' }, { key: 'Orden', label: 'Orden' },
          { key: 'Activo', label: 'Activa', fmt: pillBool }],
        campos: CATEGORIAS_CAMPOS }) },
    { id: 'marcas', label: 'Marcas', grupo: 'Catálogo', render: crudSection({
        hoja: 'Marcas', titulo: 'Marcas', singular: 'Marca', orden: 'Orden',
        columnas: [{ key: 'Nombre', label: 'Nombre' }, { key: 'LogoURL', label: 'Logo', fmt: fmtImg }, { key: 'Orden', label: 'Orden' },
          { key: 'Activo', label: 'Activa', fmt: pillBool }],
        campos: [
          { name: 'Nombre', label: 'Nombre' }, { name: 'LogoURL', label: 'Logo', type: 'image' },
          { name: 'Orden', label: 'Orden', type: 'number' }, { name: 'Activo', label: 'Activa', type: 'checkbox' }] }) },
    { id: 'atributos', label: 'Atributos de filtro', grupo: 'Catálogo', render: crudSection({
        hoja: 'AtributosFiltro', titulo: 'Atributos de filtro', singular: 'Atributo', orden: 'Orden',
        columnas: [{ key: 'Nombre', label: 'Nombre' }, { key: 'Tipo', label: 'Tipo' }, { key: 'Orden', label: 'Orden' },
          { key: 'Activo', label: 'Activo', fmt: pillBool }],
        campos: [
          { name: 'Nombre', label: 'Nombre' },
          { name: 'Tipo', label: 'Tipo', type: 'select', options: ['checkbox', 'select', 'color', 'rango'] },
          { name: 'Orden', label: 'Orden', type: 'number' }, { name: 'Activo', label: 'Activo', type: 'checkbox' }] }) },
    { id: 'cupones', label: 'Cupones', grupo: 'Catálogo', render: crudSection({
        hoja: 'Cupones', titulo: 'Cupones', singular: 'Cupón',
        columnas: [{ key: 'Codigo', label: 'Código' }, { key: 'Tipo', label: 'Tipo' },
          { key: 'Valor', label: 'Valor' }, { key: 'UsosActuales', label: 'Usos' }, { key: 'Activo', label: 'Activo', fmt: pillBool }],
        campos: [
          { name: 'Codigo', label: 'Código' },
          { name: 'Tipo', label: 'Tipo', type: 'select', options: ['porcentaje', 'monto'] },
          { name: 'Valor', label: 'Valor', type: 'number' },
          { name: 'FechaInicio', label: 'Fecha inicio', type: 'date' },
          { name: 'FechaFin', label: 'Fecha fin', type: 'date' },
          { name: 'UsosMaximos', label: 'Usos máximos (0 = sin límite)', type: 'number' },
          { name: 'Activo', label: 'Activo', type: 'checkbox' }] }) },

    { id: 'imagenes', label: 'Imágenes', grupo: 'Catálogo', render: imagenes },

    { id: 'pedidos', label: 'Pedidos', grupo: 'Ventas', render: pedidos },
    { id: 'clientes', label: 'Clientes', grupo: 'Ventas', render: clientes },
    { id: 'leads', label: 'Consultas', grupo: 'Ventas', render: leads },

    { id: 'envios', label: 'Métodos de envío', grupo: 'Envíos', render: crudSection({
        hoja: 'MetodosEnvio', titulo: 'Métodos de envío', singular: 'Método', orden: 'Orden',
        columnas: [{ key: 'Codigo', label: 'Código' }, { key: 'Nombre', label: 'Nombre' },
          { key: 'CostoFijo', label: 'Costo fijo', fmt: function (v) { return money(v); } },
          { key: 'Activo', label: 'Activo', fmt: pillBool }],
        campos: [
          { name: 'Codigo', label: 'Código', hint: 'retiro_local | domicilio_acordado | andreani' },
          { name: 'Nombre', label: 'Nombre' },
          { name: 'Descripcion', label: 'Descripción', type: 'textarea', cols: 2 },
          { name: 'CostoFijo', label: 'Costo fijo', type: 'number' },
          { name: 'RequiereCoordinacion', label: 'Requiere coordinación', type: 'checkbox' },
          { name: 'CostoVariablePorPeso', label: 'Costo variable por peso', type: 'checkbox' },
          { name: 'Orden', label: 'Orden', type: 'number' },
          { name: 'Activo', label: 'Activo', type: 'checkbox' }] }) },
    { id: 'tarifas', label: 'Tarifas Andreani', grupo: 'Envíos', render: crudSection({
        hoja: 'TarifasAndreani', titulo: 'Tarifas de Andreani', singular: 'Tarifa',
        columnas: [{ key: 'ProvinciaOCP_Desde', label: 'Zona/Prov.' }, { key: 'CostoBase', label: 'Base', fmt: function (v) { return money(v); } },
          { key: 'CostoPorKg', label: '$/kg', fmt: function (v) { return money(v); } }, { key: 'DiasEstimados', label: 'Días' },
          { key: 'Activo', label: 'Activo', fmt: pillBool }],
        campos: [
          { name: 'ProvinciaOCP_Desde', label: 'Zona / Provincia / CP desde', hint: 'CABA, Buenos Aires, Centro, NEA, NOA, Cuyo, Patagonia' },
          { name: 'ProvinciaOCP_Hasta', label: 'Zona / Provincia / CP hasta' },
          { name: 'CostoBase', label: 'Costo base', type: 'number' },
          { name: 'CostoPorKg', label: 'Costo por kg', type: 'number' },
          { name: 'DiasEstimados', label: 'Días estimados', type: 'number' },
          { name: 'Activo', label: 'Activo', type: 'checkbox' }] }) },

    { id: 'blog', label: 'Blog', grupo: 'Contenido', render: crudSection({
        hoja: 'Blog', titulo: 'Blog', singular: 'Nota',
        columnas: [{ key: 'Titulo', label: 'Título' }, { key: 'Autor', label: 'Autor' }, { key: 'Fecha', label: 'Fecha' },
          { key: 'Activo', label: 'Publicada', fmt: pillBool }],
        campos: [
          { name: 'Titulo', label: 'Título' }, { name: 'Slug', label: 'Slug (auto)' },
          { name: 'Autor', label: 'Autor' }, { name: 'Fecha', label: 'Fecha', type: 'date' },
          { name: 'Resumen', label: 'Resumen', type: 'textarea', cols: 2 },
          { name: 'ContenidoHTML', label: 'Contenido (HTML)', type: 'htmlarea', rows: 6, cols: 2 },
          { name: 'ImagenURL', label: 'Imagen', type: 'image' },
          { name: 'Activo', label: 'Publicada', type: 'checkbox' }] }) },
    { id: 'equipo', label: 'Equipo', grupo: 'Contenido', render: crudSection({
        hoja: 'Equipo', titulo: 'Equipo', singular: 'Integrante', orden: 'Orden',
        columnas: [{ key: 'Nombre', label: 'Nombre' }, { key: 'Rol', label: 'Rol' }, { key: 'Orden', label: 'Orden' },
          { key: 'Activo', label: 'Visible', fmt: pillBool }],
        campos: [
          { name: 'Nombre', label: 'Nombre' }, { name: 'Rol', label: 'Rol' },
          { name: 'FotoURL', label: 'Foto', type: 'image' },
          { name: 'Bio', label: 'Bio', type: 'textarea', cols: 2 },
          { name: 'Orden', label: 'Orden', type: 'number' }, { name: 'Activo', label: 'Visible', type: 'checkbox' }] }) },
    { id: 'faqs', label: 'FAQs', grupo: 'Contenido', render: crudSection({
        hoja: 'FAQs', titulo: 'Preguntas frecuentes', singular: 'Pregunta', orden: 'Orden',
        columnas: [{ key: 'Pregunta', label: 'Pregunta' }, { key: 'Orden', label: 'Orden' }, { key: 'Activo', label: 'Visible', fmt: pillBool }],
        campos: [
          { name: 'Pregunta', label: 'Pregunta', cols: 2 },
          { name: 'Respuesta', label: 'Respuesta', type: 'textarea', cols: 2 },
          { name: 'Orden', label: 'Orden', type: 'number' }, { name: 'Activo', label: 'Visible', type: 'checkbox' }] }) },
    { id: 'eventos', label: 'Eventos', grupo: 'Contenido', render: crudSection({
        hoja: 'Eventos', titulo: 'Eventos', singular: 'Evento', orden: 'Orden',
        columnas: [{ key: 'Titulo', label: 'Título' }, { key: 'Fecha', label: 'Fecha' }, { key: 'Lugar', label: 'Lugar' }, { key: 'Activo', label: 'Visible', fmt: pillBool }],
        campos: [
          { name: 'Titulo', label: 'Título' }, { name: 'Fecha', label: 'Fecha', type: 'date' },
          { name: 'Lugar', label: 'Lugar' },
          { name: 'Descripcion', label: 'Descripción', type: 'textarea', cols: 2 },
          { name: 'ImagenURL', label: 'Imagen', type: 'image' },
          { name: 'Orden', label: 'Orden', type: 'number' }, { name: 'Activo', label: 'Visible', type: 'checkbox' }] }) },
    { id: 'prensa', label: 'Prensa', grupo: 'Contenido', render: crudSection({
        hoja: 'Prensa', titulo: 'Prensa', singular: 'Publicación', orden: 'Orden',
        columnas: [{ key: 'Titulo', label: 'Título' }, { key: 'Medio', label: 'Medio' }, { key: 'Fecha', label: 'Fecha' }, { key: 'Activo', label: 'Visible', fmt: pillBool }],
        campos: [
          { name: 'Titulo', label: 'Título' }, { name: 'Medio', label: 'Medio' },
          { name: 'Fecha', label: 'Fecha', type: 'date' }, { name: 'URL', label: 'URL' },
          { name: 'ImagenURL', label: 'Imagen', type: 'image' },
          { name: 'Orden', label: 'Orden', type: 'number' }, { name: 'Activo', label: 'Visible', type: 'checkbox' }] }) },
    { id: 'estadisticas', label: 'Estadísticas del home', grupo: 'Contenido', render: crudSection({
        hoja: 'Estadisticas', titulo: 'Estadísticas del home', singular: 'Dato', orden: 'Orden',
        columnas: [{ key: 'Label', label: 'Etiqueta' }, { key: 'Valor', label: 'Valor' }, { key: 'Orden', label: 'Orden' }],
        campos: [
          { name: 'Label', label: 'Etiqueta' }, { name: 'Valor', label: 'Valor' },
          { name: 'Orden', label: 'Orden', type: 'number' }] }) },

    { id: 'usuarios', label: 'Administradores', grupo: 'Sistema', render: usuarios }
  ];

  function pillBool(v) { return '<span class="pill ' + (bool(v) ? 'aprobado' : 'gris') + '">' + (bool(v) ? 'sí' : 'no') + '</span>'; }
  function fmtImg(v) { return v ? '<img src="' + esc(v) + '" style="height:28px">' : '<span class="muted">—</span>'; }

  function buildSidebar() {
    var nav = document.getElementById('sideNav');
    var grupos = {};
    SECCIONES.forEach(function (s) { (grupos[s.grupo] = grupos[s.grupo] || []).push(s); });
    nav.innerHTML = Object.keys(grupos).map(function (g) {
      return (g ? '<div style="padding:14px 20px 4px;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7f99">' + esc(g) + '</div>' : '') +
        grupos[g].map(function (s) { return '<a href="#' + s.id + '" data-sec="' + s.id + '">' + esc(s.label) + '</a>'; }).join('');
    }).join('');
    var ses = Session.get();
    document.getElementById('sideUser').textContent = (ses && ses.usuario ? ses.usuario + ' · ' + ses.rol : '');
  }

  async function route() {
    var id = (location.hash || '#dashboard').slice(1);
    var sec = SECCIONES.find(function (s) { return s.id === id; }) || SECCIONES[0];
    document.querySelectorAll('#sideNav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-sec') === sec.id);
    });
    try { await sec.render(); }
    catch (e) { view().innerHTML = '<div class="card"><h3>Error</h3><p class="err">' + esc(e.message) + '</p></div>'; }
  }

  // ------------------------------------------------------------------- Boot
  function showLogin() {
    document.getElementById('appView').hidden = true;
    document.getElementById('loginView').hidden = false;
    var form = document.getElementById('loginForm');
    form.onsubmit = async function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(form).entries());
      var err = document.getElementById('loginErr'); err.textContent = '';
      var btn = form.querySelector('button'); btn.disabled = true;
      try {
        var r = await F.api.post('loginAdmin', { usuario: d.usuario, password: d.password });
        Session.set({ token: r.token, usuario: r.usuario, rol: r.rol, expira: r.expira });
        startApp();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
  }

  function startApp() {
    document.getElementById('loginView').hidden = true;
    document.getElementById('appView').hidden = false;
    document.getElementById('logoutBtn').onclick = function () { Session.clear(); location.reload(); };
    buildSidebar();
    window.addEventListener('hashchange', route);
    route();
  }

  if (Session.valido()) startApp();
  else { Session.clear(); showLogin(); }
})();
