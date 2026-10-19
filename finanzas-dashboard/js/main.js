/* Arranque: navegación entre páginas, mes visible, tema, ajustes y calculadora. */
(() => {
  const { $ } = U;
  const PAGES = {
    resumen: { title: 'Resumen', eyebrow: 'Tus gastos del mes', slot: 'calcSlotResumen', target: 'gasto', month: true },
    ahorro: { title: 'Ahorro y metas', eyebrow: 'Construye tu futuro', slot: 'calcSlotAhorro', target: 'ahorro', month: true },
    calculadora: { title: 'Calculadora', eyebrow: 'IVA, impuestos y descuentos', slot: 'calcSlotPage', target: 'gasto', month: false },
  };

  // ---------- Navegación ----------
  function currentPage() {
    const name = location.hash.replace(/^#\/?/, '');
    return PAGES[name] ? name : 'resumen';
  }

  function showPage() {
    const page = currentPage();
    const cfg = PAGES[page];
    U.state.page = page;
    Object.keys(PAGES).forEach((p) => ($(`page-${p}`).hidden = p !== page));
    document.querySelectorAll('.nav-item[data-page]').forEach((a) => {
      const on = a.dataset.page === page;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.panel-page').forEach((p) => (p.hidden = p.dataset.panel !== page));
    document.body.dataset.page = page;
    $('pageTitle').textContent = cfg.title;
    $('pageEyebrow').textContent = cfg.eyebrow;
    $('monthNav').hidden = !cfg.month;
    $(cfg.slot).appendChild($('calc'));
    Calculator.setTarget(cfg.target);
    document.title = `${cfg.title} · Mis Finanzas`;
    Charts.hideTooltip();
    render();
  }

  function render() {
    $('monthLabel').textContent = U.monthName(U.state.month);
    if (U.state.page === 'resumen') Dashboard.render();
    if (U.state.page === 'ahorro') Savings.render();
  }

  function changeMonth(key) {
    U.state.month = key;
    Dashboard.onMonthChanged();
    Savings.onMonthChanged();
    render();
  }

  // ---------- Tema ----------
  function applyTheme() {
    const theme = Store.settings().theme;
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    $('themeIcon').innerHTML = U.icon(isDark() ? 'sun' : 'moon', 22);
  }
  function isDark() {
    const t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ---------- Datos de ejemplo de gastos ----------
  function loadSampleExpenses() {
    const key = U.state.month;
    const n = U.daysIn(key);
    const upTo = Math.max(1, Math.min(n, U.elapsedDays(key) || n));
    const day = (d) => `${key}-${String(Math.min(d, upTo)).padStart(2, '0')}`;
    const sample = [
      ['Renta del departamento', 6500, 'vivienda', 1, 'Transferencia'],
      ['Supermercado', 1240.5, 'alimentacion', 2, 'Tarjeta de débito'],
      ['Gasolina', 850, 'transporte', 3, 'Tarjeta de crédito'],
      ['Internet y teléfono', 589, 'servicios', 4, 'Tarjeta de crédito'],
      ['Café con amigos', 165, 'entretenimiento', 5, 'Efectivo'],
      ['Recibo de luz', 432, 'servicios', 6, 'Transferencia'],
      ['Farmacia', 318.9, 'salud', 7, 'Tarjeta de débito'],
      ['Mercado', 620, 'alimentacion', 9, 'Efectivo'],
      ['Uber', 142, 'transporte', 10, 'Tarjeta de crédito'],
      ['Curso en línea', 299, 'educacion', 11, 'Tarjeta de crédito'],
      ['Cine', 240, 'entretenimiento', 12, 'Tarjeta de débito'],
      ['Supermercado', 980.75, 'alimentacion', 14, 'Tarjeta de débito'],
      ['Streaming', 219, 'entretenimiento', 15, 'Tarjeta de crédito'],
      ['Regalo de cumpleaños', 450, 'otros', 16, 'Efectivo'],
      ['Gasolina', 800, 'transporte', 17, 'Tarjeta de crédito'],
      ['Restaurante', 685, 'alimentacion', 18, 'Tarjeta de crédito'],
    ].map(([desc, amount, category, d, method]) => ({ desc, amount, category, date: day(d), method }));
    Store.addMany(sample);
    if (!Store.budget(key)) Store.setBudget(key, 20000);
    render();
    U.toast('Se cargaron datos de ejemplo. Puedes eliminarlos cuando quieras.');
  }

  // ---------- Ajustes y respaldo ----------
  function exportCsv() {
    const rows = Store.expensesFor(U.state.month).sort((a, b) => a.date.localeCompare(b.date));
    const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Fecha', 'Descripción', 'Categoría', 'Método de pago', 'Monto'].map(cell).join(',')];
    rows.forEach((e) => lines.push([e.date, e.desc, CATEGORY_BY_ID[e.category].name, e.method, e.amount.toFixed(2)].map(cell).join(',')));
    U.download(`gastos-${U.state.month}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function openSettings() {
    const s = Store.settings();
    $('sCurrency').value = s.currency;
    $('sIva').value = s.ivaRate;
    $('settingsDialog').showModal();
  }

  function onSettingsClose() {
    if ($('settingsDialog').returnValue !== 'save') return;
    const rate = Number($('sIva').value);
    Store.setSettings({
      currency: $('sCurrency').value,
      ivaRate: Number.isFinite(rate) && rate >= 0 ? rate : 16,
    });
    U.buildFormatters();
    Calculator.refresh();
    render();
    U.toast('Ajustes guardados');
  }

  function afterDataReplaced(message) {
    applyTheme();
    U.buildFormatters();
    $('settingsDialog').close('cancel');
    Dashboard.resetForm();
    render();
    U.toast(message);
  }

  // ---------- Arranque ----------
  function init() {
    applyTheme();
    U.buildFormatters();
    U.hydrateIcons();
    applyTheme();

    Dashboard.init();
    Savings.init();
    Calculator.init({
      ivaRate: () => Store.settings().ivaRate,
      format: (n) => U.money(n),
      useAmount(value) {
        const v = Store.round2(value);
        if (!(v > 0)) {
          U.toast('El resultado debe ser mayor que cero para usarlo');
          return;
        }
        if (U.state.page === 'ahorro') {
          Savings.fillAmount(v);
          U.toast(`${U.money(v)} listo para aportar`);
          return;
        }
        if (U.state.page === 'calculadora') location.hash = '#/resumen';
        // Espera al cambio de página para enfocar el formulario
        setTimeout(() => {
          Dashboard.fillAmount(v);
          U.toast(`${U.money(v)} listo en el formulario de gasto`);
        }, 0);
      },
    });

    $('prevMonth').addEventListener('click', () => changeMonth(U.shiftMonth(U.state.month, -1)));
    $('nextMonth').addEventListener('click', () => changeMonth(U.shiftMonth(U.state.month, 1)));
    $('monthLabel').addEventListener('click', () => changeMonth(U.monthKey(U.today)));

    $('themeBtn').addEventListener('click', () => {
      Store.setSettings({ theme: isDark() ? 'light' : 'dark' });
      applyTheme();
      render();
    });

    $('sampleBtn').addEventListener('click', loadSampleExpenses);
    $('settingsBtn').addEventListener('click', openSettings);
    $('settingsDialog').addEventListener('close', onSettingsClose);
    $('exportCsv').addEventListener('click', exportCsv);
    $('exportJson').addEventListener('click', () =>
      U.download(`respaldo-finanzas-${U.isoDate(new Date())}.json`, JSON.stringify(Store.exportData(), null, 2), 'application/json'));
    $('importJson').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!confirm('Esto reemplazará todos tus datos actuales con los del respaldo. ¿Continuar?')) return;
        Store.importData(data);
        afterDataReplaced('Respaldo restaurado');
      } catch (err) {
        alert(`No se pudo restaurar el respaldo: ${err.message}`);
      }
    });
    $('resetData').addEventListener('click', () => {
      if (!confirm('¿Borrar todos los gastos, presupuestos y metas? Esta acción no se puede deshacer.')) return;
      Store.reset();
      afterDataReplaced('Se borraron todos los datos');
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme();
      render();
    });
    let resizeTimer;
    let lastWidth = 0;
    new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w === lastWidth) return;
      lastWidth = w;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 120);
    }).observe(document.querySelector('.content'));
    window.addEventListener('scroll', Charts.hideTooltip, { passive: true });
    window.addEventListener('hashchange', showPage);

    showPage();
  }

  init();
})();
