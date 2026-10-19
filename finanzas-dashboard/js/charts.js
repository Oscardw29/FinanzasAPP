/* Gráficas SVG/HTML sin dependencias: línea acumulada y barras por categoría. */
const Charts = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const tooltipEl = () => document.getElementById('tooltip');

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function niceStep(raw) {
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  function niceScale(max, count = 4) {
    if (!(max > 0)) return { max: 100, ticks: [0, 25, 50, 75, 100] };
    const step = niceStep(max / count);
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { max: top, ticks };
  }

  function showTooltip(html, clientX, clientY) {
    const tip = tooltipEl();
    tip.innerHTML = html;
    tip.hidden = false;
    const pad = 14;
    const { width, height } = tip.getBoundingClientRect();
    let x = clientX + pad;
    let y = clientY - height - pad;
    if (x + width > window.innerWidth - 8) x = clientX - width - pad;
    if (x < 8) x = 8;
    if (y < 8) y = clientY + pad;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltipEl().hidden = true;
  }

  /**
   * Línea de varias series sobre un mismo eje.
   * cfg: { labels, series: [{ name, values, color, area, width }], formatAxis, formatEnd,
   *        tooltip(i) -> html, todayIndex, xLabel(i) }
   */
  function line(container, cfg) {
    container.innerHTML = '';
    const W = Math.max(280, container.clientWidth);
    const H = cfg.height || (W < 500 ? 220 : 260);
    const m = { t: 18, r: W < 500 ? 16 : 28, b: 28, l: W < 500 ? 44 : 56 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = cfg.labels.length;

    const all = cfg.series.flatMap((s) => s.values.filter((v) => v != null));
    const { max, ticks } = niceScale(Math.max(0, ...all));
    const x = (i) => m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => m.t + ih - (v / max) * ih;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': cfg.ariaLabel || '' });
    const grid = el('g', { class: 'grid' }, svg);
    ticks.forEach((t) => {
      if (t > 0) el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }, grid);
      const label = el('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, svg);
      label.textContent = cfg.formatAxis(t);
    });

    // Etiquetas del eje X: unos pocos días representativos
    const step = n > 20 ? 5 : n > 10 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const day = i + 1;
      if (!(i === 0 || day % step === 0 || i === n - 1)) continue;
      if (i === n - 2 && step > 1) continue; // evita choque con el último
      const t = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'tick' }, svg);
      t.textContent = cfg.xLabel ? cfg.xLabel(i) : cfg.labels[i];
    }

    // Marca de "hoy"
    if (cfg.todayIndex != null && cfg.todayIndex < n - 1) {
      const g = el('g', { class: 'today' }, svg);
      el('line', { x1: x(cfg.todayIndex), x2: x(cfg.todayIndex), y1: m.t, y2: m.t + ih }, g);
      const t = el('text', { x: x(cfg.todayIndex) + 5, y: m.t + ih - 6 }, g);
      t.textContent = 'Hoy';
    }

    el('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'baseline' }, svg);

    // Series
    cfg.series.forEach((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
      if (!pts.length) return;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      if (s.area) {
        const last = pts[pts.length - 1];
        el('path', {
          d: `${d}L${last[0].toFixed(1)},${y(0)}L${pts[0][0].toFixed(1)},${y(0)}Z`,
          fill: s.color, 'fill-opacity': 0.1, stroke: 'none',
        }, svg);
      }
      el('path', {
        d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.opacity ?? 1,
      }, svg);
      if (s.endDot) {
        const last = pts[pts.length - 1];
        el('circle', { cx: last[0], cy: last[1], r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
        if (cfg.formatEnd) {
          const lastVal = s.values.filter((v) => v != null).pop();
          const nearRight = last[0] > W - m.r - 90;
          const t = el('text', {
            x: last[0] + (nearRight ? -10 : 10), y: last[1] - 10,
            'text-anchor': nearRight ? 'end' : 'start', class: 'end-label',
          }, svg);
          t.textContent = cfg.formatEnd(lastVal);
        }
      }
    });

    // Capa de interacción: cruz + tooltip
    const hover = el('g', { visibility: 'hidden' }, svg);
    const cross = el('line', { class: 'crosshair', y1: m.t, y2: m.t + ih }, hover);
    const dots = cfg.series.map((s) => el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, hover));
    const hit = el('rect', { x: m.l - 10, y: 0, width: iw + 20, height: H, fill: 'transparent' }, svg);

    function move(evt) {
      const rect = svg.getBoundingClientRect();
      const px = ((evt.clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      hover.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      cfg.series.forEach((s, k) => {
        const v = s.values[i];
        dots[k].setAttribute('visibility', v == null ? 'hidden' : 'visible');
        if (v != null) {
          dots[k].setAttribute('cx', x(i));
          dots[k].setAttribute('cy', y(v));
        }
      });
      showTooltip(cfg.tooltip(i), evt.clientX, evt.clientY);
    }
    function leave() {
      hover.setAttribute('visibility', 'hidden');
      hideTooltip();
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);

    container.appendChild(svg);
  }

  return { line, showTooltip, hideTooltip };
})();
