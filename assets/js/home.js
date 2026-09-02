(function (F) {
  'use strict';
  var esc = F.ui.esc;

  async function init() {
    await F.ui.renderChrome();
    var cfg = F.cfg || {};

    // --- Hero ---
    if (cfg.BannerPrincipalURL) {
      document.getElementById('hero').style.backgroundImage = 'url(' + cfg.BannerPrincipalURL + ')';
    }
    if (cfg.NombreTienda) document.getElementById('heroTitle').textContent =
      'Todo para tu moto en ' + cfg.NombreTienda;

    // --- Estadísticas ---
    F.api.get('getEstadisticas').then(function (stats) {
      if (!stats || !stats.length) return;
      document.getElementById('statsSection').hidden = false;
      document.getElementById('stats').innerHTML = stats.map(function (s) {
        return '<div class="stat"><b>' + esc(s.Valor) + '</b><span>' + esc(s.Label) + '</span></div>';
      }).join('');
    }).catch(function () {});

    // --- Destacados ---
    F.api.get('getProductos', { destacado: 'true', porPagina: 8 }).then(function (r) {
      F.render.grid(document.getElementById('destacados'), r.items, 'Todavía no hay productos destacados.');
    }).catch(function (e) {
      F.ui.errorBox(document.getElementById('destacados'), e.message);
    });

    // --- Marcas ---
    F.api.get('getMarcas').then(function (marcas) {
      document.getElementById('brands').innerHTML = (marcas || []).map(function (m) {
        var inner = m.LogoURL
          ? '<img src="' + esc(m.LogoURL) + '" alt="' + esc(m.Nombre) + '">'
          : '<span class="brand-name">' + esc(m.Nombre) + '</span>';
        return '<a href="catalogo.html?marca=' + encodeURIComponent(m.ID) + '">' + inner + '</a>';
      }).join('');
    }).catch(function () {});

    // --- Sobre nosotros + equipo ---
    if (cfg.SobreNosotrosHTML) document.getElementById('sobreNosotros').innerHTML = cfg.SobreNosotrosHTML;
    F.api.get('getEquipo').then(function (eq) {
      document.getElementById('equipo').innerHTML = (eq || []).map(function (m) {
        return '<article class="card"><div class="thumb"><img src="' + esc(F.img(m.FotoURL)) +
          '" alt="' + esc(m.Nombre) + '"></div><div class="body"><h3>' + esc(m.Nombre) +
          '</h3><span class="brandname">' + esc(m.Rol || '') + '</span>' +
          (m.Bio ? '<p class="muted" style="font-size:.85rem">' + esc(m.Bio) + '</p>' : '') +
          '</div></article>';
      }).join('');
    }).catch(function () {});

    // --- Formulario de contacto ---
    var form = document.getElementById('contactForm');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Enviando...';
      var lead = Object.fromEntries(new FormData(form).entries());
      try {
        await F.api.post('addLead', { lead: lead });
        form.reset();
        F.ui.toast('¡Gracias! Te vamos a responder pronto.', 'ok');
      } catch (err) {
        F.ui.toast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Enviar consulta';
      }
    });
  }

  init();
})(window.FURI = window.FURI || {});
