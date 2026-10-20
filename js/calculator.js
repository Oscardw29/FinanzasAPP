/* Calculadora: operaciones básicas, IVA, impuestos/retenciones y descuentos. */
const Calculator = (() => {
  const $ = (id) => document.getElementById(id);
  const HISTORY_KEY = 'misFinanzas.calcHistory';
  let opts;

  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const num = (id) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : 0;
  };
  const plain = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 10 });

  // ===================== Evaluador de expresiones =====================
  // Gramática: expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ;
  // unary := '-' unary | number '%'?   — "200+10%" se interpreta como 200 + 10 % de 200.
  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/[\d.]/.test(c)) {
        let j = i;
        while (j < src.length && /[\d.]/.test(src[j])) j++;
        const text = src.slice(i, j);
        if ((text.match(/\./g) || []).length > 1 || text === '.') throw new Error('Número inválido');
        tokens.push({ t: 'num', v: parseFloat(text) });
        i = j;
      } else if ('+-*/%'.includes(c)) {
        tokens.push({ t: c });
        i++;
      } else {
        throw new Error('Carácter inválido');
      }
    }
    return tokens;
  }

  function evaluate(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos]?.t;

    function unary() {
      if (peek() === '-') {
        pos++;
        const r = unary();
        return { v: -r.v, pct: r.pct };
      }
      if (peek() === '+') {
        pos++;
        return unary();
      }
      const tok = tokens[pos++];
      if (!tok || tok.t !== 'num') throw new Error('Expresión incompleta');
      if (peek() === '%') {
        pos++;
        return { v: tok.v / 100, pct: true };
      }
      return { v: tok.v, pct: false };
    }

    function term(left) {
      const first = unary();
      if (first.pct && left != null && peek() !== '*' && peek() !== '/') return left * first.v;
      let v = first.v;
      while (peek() === '*' || peek() === '/') {
        const op = tokens[pos++].t;
        const r = unary().v;
        if (op === '/' && r === 0) throw new Error('No se puede dividir entre 0');
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }

    let v = term(null);
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].t;
      const r = term(v);
      v = op === '+' ? v + r : v - r;
    }
    if (pos < tokens.length) throw new Error('Expresión inválida');
    if (!Number.isFinite(v)) throw new Error('Resultado fuera de rango');
    return parseFloat(v.toPrecision(12));
  }

  // ===================== Calculadora básica =====================
  const basic = { expr: '', done: false, lastExpr: '', error: '' };
  let history = loadHistory();

  const isOp = (c) => '+-*/'.includes(c);
  const stripTrailing = (s) => s.replace(/[+\-*/]+$/, '');

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }
  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch {
      /* sin almacenamiento disponible */
    }
  }
  function pushHistory(expr, result) {
    history.unshift({ expr, result });
    history = history.slice(0, 20);
    saveHistory();
  }

  function prettyExpr(s) {
    return s
      .replace(/\d+(\.\d*)?/g, (m) => {
        const [int, dec] = m.split('.');
        const grouped = Number(int).toLocaleString('en-US');
        return dec !== undefined ? `${grouped}.${dec}` : grouped;
      })
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/(\d|%|\.)\+/g, '$1 + ')
      .replace(/(\d|%|\.)-/g, '$1 − ')
      .replace(/-/g, '−')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toExprString(n) {
    // Evita notación científica en el texto de la expresión
    const s = String(n);
    return /e/i.test(s) ? n.toFixed(10).replace(/\.?0+$/, '') : s;
  }

  function currentValue() {
    if (!basic.expr) return 0;
    try {
      return evaluate(stripTrailing(basic.expr) || '0');
    } catch {
      return NaN;
    }
  }

  function renderBasic() {
    const valueEl = $('calcValue');
    const exprEl = $('calcExpr');
    valueEl.classList.toggle('error', !!basic.error);
    if (basic.error) {
      valueEl.textContent = basic.error;
      exprEl.textContent = prettyExpr(basic.lastExpr) || ' ';
    } else if (basic.done) {
      valueEl.textContent = plain.format(Number(basic.expr));
      exprEl.textContent = `${prettyExpr(basic.lastExpr)} =`;
    } else {
      valueEl.textContent = basic.expr ? prettyExpr(basic.expr) : '0';
      const hasOp = /[+\-*/%]/.test(basic.expr.replace(/^-/, ''));
      const preview = currentValue();
      exprEl.textContent = hasOp && Number.isFinite(preview) ? `= ${plain.format(preview)}` : ' ';
    }
    valueEl.scrollLeft = valueEl.scrollWidth;
    renderHistory();
  }

  function renderHistory() {
    const list = $('historyList');
    if (!history.length) {
      list.innerHTML = '<li class="h-empty">Tus cálculos aparecerán aquí</li>';
      return;
    }
    list.innerHTML = history
      .map((h, i) => `<li><button type="button" data-i="${i}" title="Usar este resultado">
        <span class="h-expr">${prettyExpr(h.expr)}</span><span class="h-res">= ${plain.format(h.result)}</span></button></li>`)
      .join('');
  }

  function press(k) {
    if (basic.error) {
      basic.error = '';
      basic.expr = '';
      basic.done = false;
    }
    const e = basic.expr;
    const last = e.slice(-1);

    if (/^\d$/.test(k)) {
      if (basic.done) {
        basic.expr = '';
        basic.done = false;
      }
      const curNum = basic.expr.match(/[\d.]*$/)[0];
      if (basic.expr.slice(-1) === '%') basic.expr += '*';
      if (curNum === '0') basic.expr = basic.expr.slice(0, -1);
      if (curNum.replace('.', '').length >= 15) return;
      basic.expr += k;
    } else if (k === '.') {
      if (basic.done) {
        basic.expr = '';
        basic.done = false;
      }
      const curNum = basic.expr.match(/[\d.]*$/)[0];
      if (curNum.includes('.')) return;
      if (basic.expr.slice(-1) === '%') basic.expr += '*';
      basic.expr += curNum === '' ? '0.' : '.';
    } else if (isOp(k)) {
      basic.done = false;
      if (!e) {
        if (k === '-') basic.expr = '-';
        else basic.expr = '0' + k;
      } else if (isOp(last)) {
        // Permite un signo negativo después de × o ÷ (ej. 5 × −3); en otro caso reemplaza el operador
        if (k === '-' && (last === '*' || last === '/')) basic.expr += '-';
        else if (e === '-') return;
        else basic.expr = e.replace(/[+\-*/]+$/, '') + k;
      } else if (last === '.') {
        basic.expr = e.slice(0, -1) + k;
      } else {
        basic.expr += k;
      }
    } else if (k === '%') {
      basic.done = false;
      if (/\d$/.test(e)) basic.expr += '%';
    } else if (k === 'neg') {
      basic.done = false;
      const m = e.match(/[\d.]+%?$/);
      if (!m) {
        if (!e || isOp(last)) basic.expr += last === '-' ? '' : '-';
      } else {
        const i = e.length - m[0].length;
        const before = e.slice(0, i);
        const unaryMinus = before.endsWith('-') && (before.length === 1 || isOp(before.slice(-2, -1)));
        basic.expr = unaryMinus ? before.slice(0, -1) + m[0] : before + '-' + m[0];
      }
    } else if (k === 'back') {
      if (basic.done) {
        basic.expr = '';
        basic.done = false;
      } else {
        basic.expr = e.slice(0, -1);
      }
    } else if (k === 'C') {
      basic.expr = '';
      basic.done = false;
      basic.lastExpr = '';
    } else if (k === '=') {
      const src = stripTrailing(e);
      if (!src || basic.done) return;
      try {
        const result = evaluate(src);
        if (/[+\-*/%]/.test(src.replace(/^-/, ''))) pushHistory(src, result);
        basic.lastExpr = src;
        basic.expr = toExprString(result);
        basic.done = true;
      } catch (err) {
        basic.lastExpr = src;
        basic.error = err.message;
      }
    }
    renderBasic();
  }

  function applyIvaToBasic(add) {
    const v = currentValue();
    if (!Number.isFinite(v) || !basic.expr) return;
    const rate = opts.ivaRate();
    const result = parseFloat((add ? v * (1 + rate / 100) : v / (1 + rate / 100)).toPrecision(12));
    const label = `${toExprString(v)}${add ? '+' : '-'}IVA ${rate}%`;
    history.unshift({ expr: label, result: round(result) });
    saveHistory();
    basic.lastExpr = '';
    basic.expr = toExprString(round(result));
    basic.done = true;
    renderBasic();
    $('calcExpr').textContent = `${plain.format(v)} ${add ? '+' : '−'} IVA ${rate} % =`;
  }

  function keyFromEvent(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    const map = { Enter: '=', '=': '=', Backspace: 'back', Escape: 'C', Delete: 'C', ',': '.', x: '*', X: '*' };
    if (map[e.key]) return map[e.key];
    if (/^[\d.+\-*/%]$/.test(e.key)) return e.key;
    return null;
  }

  function onGlobalKey(e) {
    if ($('panelBasic').hidden) return;
    if (document.querySelector('dialog[open]')) return;
    const a = document.activeElement;
    if (a && (a.matches('input, select, textarea') || a.isContentEditable)) return;
    const k = keyFromEvent(e);
    if (!k) return;
    // Enter sobre un botón enfocado fuera del teclado debe seguir activándolo
    if (e.key === 'Enter' && a && a.tagName === 'BUTTON' && !a.closest('#keypad')) return;
    e.preventDefault();
    press(k);
    const btn = document.querySelector(`#keypad [data-k="${CSS.escape(k)}"]`);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 110);
    }
  }

  // ===================== IVA =====================
  let ivaRate = null;

  function setIvaRate(rate, fromInput = false) {
    ivaRate = rate;
    document.querySelectorAll('#ivaChips .chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.rate) === rate));
    if (!fromInput) $('ivaRate').value = rate;
    renderIva();
  }

  function renderIva() {
    const mode = document.querySelector('input[name="ivaMode"]:checked').value;
    $('ivaAmountLabel').textContent = mode === 'add' ? 'Precio sin IVA' : 'Precio con IVA incluido';
    const a = num('ivaAmount');
    const r = (ivaRate ?? 0) / 100;
    const subtotal = mode === 'add' ? a : a / (1 + r);
    const iva = mode === 'add' ? a * r : a - subtotal;
    const total = mode === 'add' ? a + iva : a;
    $('ivaResults').innerHTML = `
      <dt>Subtotal (sin IVA)</dt><dd>${opts.format(round(subtotal))}</dd>
      <dt>IVA (${plain.format(ivaRate ?? 0)} %)</dt><dd>${opts.format(round(iva))}</dd>
      <dt class="total">Total con IVA</dt><dd class="total">${opts.format(round(total))}</dd>`;
    return round(total);
  }

  // ===================== Impuestos y retenciones =====================
  const RET_IVA = 10.6667; // dos terceras partes del IVA al 16 %
  const PRESETS = {
    iva: () => [{ name: 'IVA', rate: opts.ivaRate(), sign: 1 }],
    honorarios: () => [
      { name: 'IVA', rate: 16, sign: 1 },
      { name: 'Retención ISR', rate: 10, sign: -1 },
      { name: 'Retención IVA', rate: RET_IVA, sign: -1 },
    ],
    arrendamiento: () => [
      { name: 'IVA', rate: 16, sign: 1 },
      { name: 'Retención ISR', rate: 10, sign: -1 },
      { name: 'Retención IVA', rate: RET_IVA, sign: -1 },
    ],
    resico: () => [
      { name: 'IVA', rate: 16, sign: 1 },
      { name: 'Retención ISR', rate: 1.25, sign: -1 },
      { name: 'Retención IVA', rate: RET_IVA, sign: -1 },
    ],
  };
  let taxRows = [];

  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function drawTaxRows() {
    const box = $('taxRows');
    box.innerHTML = taxRows.length
      ? `<div class="tax-row tax-head"><span>Concepto</span><span>Tasa %</span><span>Tipo</span><span></span></div>` +
        taxRows
          .map((r, i) => `<div class="tax-row" data-i="${i}">
            <input type="text" class="t-name" value="${escapeAttr(r.name)}" aria-label="Nombre del impuesto" maxlength="30">
            <input type="number" class="t-rate" value="${r.rate}" min="0" max="100" step="0.0001" aria-label="Tasa en porcentaje">
            <select class="t-sign" aria-label="Tipo">
              <option value="1"${r.sign > 0 ? ' selected' : ''}>Suma</option>
              <option value="-1"${r.sign < 0 ? ' selected' : ''}>Retiene</option>
            </select>
            <button type="button" class="rm" aria-label="Quitar ${escapeAttr(r.name)}">✕</button>
          </div>`)
          .join('')
      : '<p class="muted" style="font-size:13px">Sin impuestos. Agrega uno abajo.</p>';
  }

  function renderTax() {
    const base = num('taxBase');
    let total = base;
    let lines = `<dt>Subtotal</dt><dd>${opts.format(round(base))}</dd>`;
    taxRows.forEach((r) => {
      const amount = round((base * (Number(r.rate) || 0)) / 100);
      total += r.sign * amount;
      lines += `<dt>${escapeAttr(r.name || 'Impuesto')} (${plain.format(Number(r.rate) || 0)} %)</dt>
        <dd class="${r.sign < 0 ? 'minus' : ''}">${r.sign < 0 ? '−' : '+'} ${opts.format(amount)}</dd>`;
    });
    const hasRet = taxRows.some((r) => r.sign < 0);
    lines += `<dt class="total">${hasRet ? 'Total neto a cobrar/pagar' : 'Total'}</dt><dd class="total">${opts.format(round(total))}</dd>`;
    $('taxResults').innerHTML = lines + '<dt style="grid-column:1/-1;font-size:11px" class="muted">Tasas de referencia; confirma la tuya con tu contador.</dt>';
    return round(total);
  }

  function applyPreset(name) {
    if (PRESETS[name]) taxRows = PRESETS[name]();
    drawTaxRows();
    renderTax();
  }

  // ===================== Descuentos =====================
  function renderDisc() {
    const price = num('discPrice');
    const type = $('discType').value;
    const value = Math.max(0, num('discValue'));
    const extra = Math.min(100, Math.max(0, num('discExtra')));
    const first = type === 'pct' ? (price * Math.min(100, value)) / 100 : Math.min(price, value);
    const afterFirst = price - first;
    const second = (afterFirst * extra) / 100;
    const discounted = afterFirst - second;
    const withIva = $('discIva').checked;
    const rate = opts.ivaRate();
    const iva = withIva ? (discounted * rate) / 100 : 0;
    const total = discounted + iva;
    const saving = price - discounted;
    const effective = price > 0 ? (saving / price) * 100 : 0;

    document.querySelectorAll('#discChips .chip').forEach((c) =>
      c.classList.toggle('active', type === 'pct' && Number(c.dataset.pct) === value));

    let html = `<dt>Precio original</dt><dd>${opts.format(round(price))}</dd>
      <dt>Descuento${type === 'pct' ? ` (${plain.format(Math.min(100, value))} %)` : ''}</dt><dd class="minus">− ${opts.format(round(first))}</dd>`;
    if (extra > 0) html += `<dt>Descuento adicional (${plain.format(extra)} %)</dt><dd class="minus">− ${opts.format(round(second))}</dd>`;
    if (withIva) {
      html += `<dt>Precio con descuento</dt><dd>${opts.format(round(discounted))}</dd>
        <dt>IVA (${plain.format(rate)} %)</dt><dd>+ ${opts.format(round(iva))}</dd>`;
    }
    html += `<dt class="total">Total a pagar</dt><dd class="total">${opts.format(round(total))}</dd>
      <dt class="saving">Ahorras</dt><dd class="saving">${opts.format(round(saving))} · ${plain.format(round(effective))} %</dd>`;
    $('discResults').innerHTML = html;
    return round(total);
  }

  // ===================== Pestañas =====================
  function selectTab(tab) {
    document.querySelectorAll('#calc [role="tab"]').forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
  }

  // ===================== Arranque =====================
  function init(options) {
    opts = options;

    // Básica
    $('keypad').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) press(b.dataset.k);
    });
    document.addEventListener('keydown', onGlobalKey);
    $('basicUse').addEventListener('click', () => {
      const v = currentValue();
      if (Number.isFinite(v)) opts.useAmount(v);
    });
    $('basicAddIva').addEventListener('click', () => applyIvaToBasic(true));
    $('basicSubIva').addEventListener('click', () => applyIvaToBasic(false));
    $('historyList').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const h = history[Number(b.dataset.i)];
      basic.error = '';
      basic.lastExpr = h.expr;
      basic.expr = toExprString(h.result);
      basic.done = true;
      renderBasic();
    });
    $('clearHistory').addEventListener('click', () => {
      history = [];
      saveHistory();
      renderHistory();
    });

    // Pestañas (con flechas del teclado)
    const tabs = [...document.querySelectorAll('#calc [role="tab"]')];
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next);
        next.focus();
      });
    });
    selectTab(tabs[0]);

    // IVA
    $('ivaChips').addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (c) setIvaRate(Number(c.dataset.rate));
    });
    $('ivaRate').addEventListener('input', () => setIvaRate(Math.min(100, Math.max(0, num('ivaRate'))), true));
    $('ivaAmount').addEventListener('input', renderIva);
    document.querySelectorAll('input[name="ivaMode"]').forEach((r) => r.addEventListener('change', renderIva));
    $('ivaUse').addEventListener('click', () => opts.useAmount(renderIva()));

    // Impuestos
    $('taxPreset').addEventListener('change', (e) => applyPreset(e.target.value));
    $('taxBase').addEventListener('input', renderTax);
    $('taxRows').addEventListener('input', (e) => {
      const row = e.target.closest('.tax-row[data-i]');
      if (!row) return;
      const r = taxRows[Number(row.dataset.i)];
      if (e.target.classList.contains('t-name')) r.name = e.target.value;
      if (e.target.classList.contains('t-rate')) r.rate = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
      $('taxPreset').value = 'custom';
      renderTax();
    });
    $('taxRows').addEventListener('change', (e) => {
      const row = e.target.closest('.tax-row[data-i]');
      if (!row || !e.target.classList.contains('t-sign')) return;
      taxRows[Number(row.dataset.i)].sign = Number(e.target.value);
      $('taxPreset').value = 'custom';
      renderTax();
    });
    $('taxRows').addEventListener('click', (e) => {
      const b = e.target.closest('.rm');
      if (!b) return;
      taxRows.splice(Number(b.closest('.tax-row').dataset.i), 1);
      $('taxPreset').value = 'custom';
      drawTaxRows();
      renderTax();
    });
    $('addTaxRow').addEventListener('click', () => {
      taxRows.push({ name: 'Impuesto', rate: 0, sign: 1 });
      $('taxPreset').value = 'custom';
      drawTaxRows();
      renderTax();
      const inputs = $('taxRows').querySelectorAll('.t-name');
      inputs[inputs.length - 1].select();
    });
    $('taxUse').addEventListener('click', () => opts.useAmount(renderTax()));

    // Descuentos
    ['discPrice', 'discValue', 'discExtra'].forEach((id) => $(id).addEventListener('input', renderDisc));
    $('discType').addEventListener('change', renderDisc);
    $('discIva').addEventListener('change', renderDisc);
    $('discChips').addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      $('discType').value = 'pct';
      $('discValue').value = c.dataset.pct;
      renderDisc();
    });
    $('discUse').addEventListener('click', () => opts.useAmount(renderDisc()));

    refresh();
    renderBasic();
  }

  /** Recalcula todo con la moneda y la tasa de IVA vigentes. */
  function refresh() {
    setIvaRate(opts.ivaRate());
    $('basicAddIva').textContent = `+ IVA ${plain.format(opts.ivaRate())} %`;
    $('basicSubIva').textContent = `− IVA ${plain.format(opts.ivaRate())} %`;
    $('discIva').nextElementSibling.textContent = `Sumar IVA (${plain.format(opts.ivaRate())} %) al precio final`;
    applyPreset($('taxPreset').value === 'custom' && taxRows.length ? 'custom' : $('taxPreset').value);
    renderDisc();
  }

  /** Cambia el destino que muestran los botones «Usar…» (ej. «gasto» o «ahorro»). */
  function setTarget(label) {
    $('basicUse').textContent = `Usar en ${label}`;
    ['ivaUse', 'taxUse', 'discUse'].forEach((id) => ($(id).textContent = `Usar total en ${label}`));
  }

  return { init, refresh, evaluate, setTarget };
})();
