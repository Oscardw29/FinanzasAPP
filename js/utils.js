/* Utilidades compartidas: fechas, formato de dinero, íconos, avisos y descargas. */
const U = (() => {
  const LOCALE = 'es-MX';
  const $ = (id) => document.getElementById(id);
  const today = new Date();

  // Estado de interfaz compartido entre páginas
  const state = { month: monthKey(today), page: 'resumen' };

  function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function isoDate(d) {
    return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function parseMonth(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  function parseDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function shiftMonth(key, delta) {
    const d = parseMonth(key);
    d.setMonth(d.getMonth() + delta);
    return monthKey(d);
  }
  function daysIn(key) {
    const d = parseMonth(key);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function monthName(key, withYear = true) {
    const opts = withYear ? { month: 'long', year: 'numeric' } : { month: 'long' };
    const text = new Intl.DateTimeFormat(LOCALE, opts).format(parseMonth(key));
    return withYear ? capitalize(text) : text;
  }
  function shortMonth(key) {
    return capitalize(new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(parseMonth(key)).replace('.', ''));
  }
  /** Días transcurridos del mes: todo si es pasado, 0 si es futuro. */
  function elapsedDays(key) {
    const current = monthKey(today);
    if (key < current) return daysIn(key);
    if (key > current) return 0;
    return today.getDate();
  }
  function daysBetween(fromIso, toIso) {
    return Math.round((parseDate(toIso) - parseDate(fromIso)) / 86400000);
  }
  function relativeDay(iso) {
    const diff = daysBetween(iso, isoDate(today));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff > 1 && diff < 7) return `Hace ${diff} días`;
    return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: diff > 300 ? 'numeric' : undefined }).format(parseDate(iso));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let moneyFmt, compactFmt;
  function buildFormatters() {
    const currency = Store.settings().currency;
    moneyFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
    compactFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  }
  const money = (n) => moneyFmt.format(n || 0);
  const compact = (n) => (Math.abs(n) >= 1000 ? compactFmt.format(n) : moneyFmt.format(n).replace(/\.00$/, ''));

  // ----- Íconos (trazos de 24×24) -----
  const PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M8.5 7h7"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.5h.01M12 18.5h.01M15.5 18.5h.01"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.4 11.5h11l2-8H6.6"/>',
    car: '<path d="M3.5 17v-4.5L6 6.5h12l2.5 6V17"/><path d="M3.5 13h17"/><path d="M3.5 17h17v2.5h-3V17M6.5 19.5h-3V17"/><circle cx="7.5" cy="15" r=".6"/><circle cx="16.5" cy="15" r=".6"/>',
    bolt: '<path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H12z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5 15.5 12 10 15.5z"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.2-9.3A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 9.2 4.4C19.5 15.4 12 20 12 20Z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    chevronL: '<path d="m15 6-6 6 6 6"/>',
    chevronR: '<path d="m9 6 6 6-6 6"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5V18a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 7.5Z"/><circle cx="16" cy="14.5" r="1.2"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    piggy: '<path d="M19 11.5c0-3.6-3.4-6-7.5-6S4 7.9 4 11.5c0 2 1 3.6 2.5 4.6V19h3v-1.6c.8.2 1.6.3 2.5.3s1.7-.1 2.5-.3V19h3v-2.9c.6-.4 1.1-.9 1.5-1.6h1.5v-3H19z"/><circle cx="15.5" cy="10.5" r=".6"/><path d="M9.5 8h3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  };
  function icon(name, size = 20) {
    return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  }
  /** Sustituye los <span data-icon="..."> del documento por su SVG. */
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20);
    });
  }

  // ----- Aviso inferior con acción opcional -----
  let toastTimer;
  function toast(message, action) {
    const t = $('toast');
    t.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    t.appendChild(span);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.label;
      b.addEventListener('click', () => {
        action.run();
        t.hidden = true;
      });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), action ? 6000 : 3000);
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    LOCALE, $, today, state,
    monthKey, isoDate, parseMonth, parseDate, shiftMonth, daysIn, monthName, shortMonth, elapsedDays, daysBetween, relativeDay,
    escapeHtml, buildFormatters, money, compact, icon, hydrateIcons, toast, download,
  };
})();
