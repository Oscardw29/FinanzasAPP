/* Página de resumen: indicadores del mes, gráfica acumulada, categorías y movimientos. */
const Dashboard = (() => {
  const { $, money, compact } = U;
  const ui = { editingId: null, catFilter: '', search: '' };
  const month = () => U.state.month;

  function render() {
    const key = month();
    const expenses = Store.expensesFor(key);
    const budget = Store.budget(key);
    const spent = Store.round2(expenses.reduce((s, e) => s + e.amount, 0));
    const nDays = U.daysIn(key);
    const elapsed = U.elapsedDays(key);

    renderKpis({ key, budget, spent, nDays, elapsed });
    renderLine({ key, expenses, budget, nDays, elapsed });
    renderCategories(expenses, spent);
    renderTable(expenses);
  }

  // ---------- Indicadores ----------
  function renderKpis({ key, budget, spent, nDays, elapsed }) {
    const current = U.monthKey(U.today);
    const isCurrent = key === current;
    $('overviewTitle').textContent = `Gasto de ${U.monthName(key, false)}`;
    $('kpiSpent').textContent = money(spent);

    // Comparación con el mes anterior a la misma fecha
    const prevKey = U.shiftMonth(key, -1);
    const cutoff = isCurrent ? U.today.getDate() : 31;
    const prevSpent = Store.expensesFor(prevKey)
      .filter((e) => Number(e.date.slice(8, 10)) <= cutoff)
      .reduce((s, e) => s + e.amount, 0);
    const delta = $('kpiDelta');
    if (prevSpent > 0 && spent > 0) {
      const change = ((spent - prevSpent) / prevSpent) * 100;
      const up = change >= 0;
      delta.innerHTML = `<span class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(change).toFixed(1)} %</span> vs. ${U.monthName(prevKey, false)}`;
    } else {
      delta.textContent = isCurrent ? 'Este mes' : '';
    }

    // Presupuesto y medidor
    $('kpiBudget').textContent = budget ? money(budget) : 'Sin definir';
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    const status = !budget ? 'none' : pct > 100 ? 'critical' : pct >= 80 ? 'warning' : 'good';
    const meter = $('budgetMeter');
    meter.dataset.status = status;
    meter.setAttribute('aria-valuenow', Math.min(100, Math.round(pct)));
    $('meterFill').style.width = `${Math.min(100, pct)}%`;
    const chip = $('statusChip');
    chip.dataset.status = status;
    chip.textContent = { none: 'Sin presupuesto', good: 'Vas bien', warning: 'Cerca del límite', critical: 'Presupuesto excedido' }[status];
    $('meterText').textContent = budget ? `Llevas ${pct.toFixed(0)} % de tu presupuesto` : 'Define un presupuesto para medir tu avance';

    // Disponible
    const available = budget - spent;
    $('kpiAvailable').textContent = budget ? money(available) : '—';
    const remainingDays = isCurrent ? nDays - U.today.getDate() + 1 : key > current ? nDays : 0;
    $('kpiAvailableSub').textContent = !budget
      ? ''
      : available < 0
        ? `Te pasaste ${money(-available)}`
        : remainingDays > 0
          ? `${money(available / remainingDays)} por día`
          : 'Mes cerrado';

    // Promedio diario
    const daily = elapsed > 0 ? spent / elapsed : 0;
    $('kpiDaily').textContent = money(daily);
    $('kpiDailySub').textContent = elapsed > 0 ? `En ${elapsed} ${elapsed === 1 ? 'día' : 'días'}` : 'El mes aún no empieza';

    // Proyección
    const projection = isCurrent ? daily * nDays : spent;
    $('kpiProjection').textContent = money(projection);
    $('kpiProjectionSub').textContent = !isCurrent
      ? key < current ? 'Total final del mes' : 'Mes futuro'
      : !budget
        ? 'Si sigues a este ritmo'
        : projection > budget
          ? `Excederías por ${money(projection - budget)}`
          : `Te sobrarían ${money(budget - projection)}`;
  }

  // ---------- Gráfica acumulada ----------
  function renderLine({ key, expenses, budget, nDays, elapsed }) {
    const container = $('lineChart');
    const legend = $('lineLegend');
    const daily = new Array(nDays).fill(0);
    expenses.forEach((e) => {
      const d = Number(e.date.slice(8, 10));
      if (d >= 1 && d <= nDays) daily[d - 1] += e.amount;
    });

    if (!expenses.length && !budget) {
      legend.innerHTML = '';
      container.innerHTML = '<div class="chart-empty">Registra gastos para ver cómo avanza tu mes</div>';
      return;
    }

    let run = 0;
    const lastDay = key > U.monthKey(U.today) ? 0 : elapsed;
    const cumulative = daily.map((v, i) => {
      run += v;
      return i < Math.max(lastDay, 1) ? Store.round2(run) : null;
    });
    const pace = budget > 0 ? daily.map((_, i) => Store.round2((budget * (i + 1)) / nDays)) : null;

    const series = [];
    if (pace) series.push({ name: 'Ritmo ideal', values: pace, color: 'rgba(255,255,255,0.5)', width: 1.5, tip: 'var(--muted)' });
    series.push({ name: 'Gasto acumulado', values: cumulative, color: '#ffffff', area: true, endDot: true, tip: 'var(--primary)' });

    legend.innerHTML = series
      .slice()
      .reverse()
      .map((s) => `<span class="legend-item"><span class="legend-key" style="background:${s.color}"></span>${s.name}</span>`)
      .join('');

    const shortDate = new Intl.DateTimeFormat(U.LOCALE, { day: 'numeric', month: 'short' });
    const base = U.parseMonth(key);
    Charts.line(container, {
      labels: daily.map((_, i) => String(i + 1)),
      series,
      height: container.clientWidth < 500 ? 200 : 230,
      ariaLabel: `Gasto acumulado de ${U.monthName(key)}`,
      todayIndex: key === U.monthKey(U.today) ? U.today.getDate() - 1 : null,
      formatAxis: compact,
      formatEnd: money,
      tooltip(i) {
        const date = shortDate.format(new Date(base.getFullYear(), base.getMonth(), i + 1));
        const rows = [];
        if (cumulative[i] != null) {
          rows.push(['var(--primary)', 'Acumulado', money(cumulative[i])]);
          rows.push(['', 'Gasto del día', money(daily[i])]);
        }
        if (pace) rows.push(['var(--muted)', 'Ritmo ideal', money(pace[i])]);
        if (cumulative[i] != null && pace) {
          const diff = cumulative[i] - pace[i];
          rows.push(['', diff > 0 ? 'Arriba del ritmo' : 'Debajo del ritmo', money(Math.abs(diff))]);
        }
        return `<div class="tt-title">${date}</div>` + rows
          .map(([c, k, v]) => `<div class="tt-row"><span class="tt-key">${c ? `<span class="dot" style="background:${c}"></span>` : ''}${k}</span><span class="tt-val">${v}</span></div>`)
          .join('');
      },
    });
  }

  // ---------- Categorías ----------
  function renderCategories(expenses, spent) {
    const container = $('catChart');
    const rows = CATEGORIES.map((c) => {
      const items = expenses.filter((e) => e.category === c.id);
      return { ...c, value: Store.round2(items.reduce((s, e) => s + e.amount, 0)), count: items.length };
    })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);

    if (!rows.length) {
      container.innerHTML = '<div class="card glass chart-empty small">Sin gastos registrados en este mes</div>';
      return;
    }
    container.innerHTML = rows
      .map((r, i) => {
        const pct = spent > 0 ? (r.value / spent) * 100 : 0;
        const active = ui.catFilter === r.id;
        return `<button type="button" class="card glass cat-card${active ? ' active' : ''}${ui.catFilter && !active ? ' dim' : ''}"
            data-cat="${r.id}" aria-pressed="${active}" style="--c:${r.color}">
          <span class="cat-badge">${U.icon(r.icon, 22)}</span>
          <span class="cat-name">${r.name}</span>
          <span class="cat-sub">${r.count} ${r.count === 1 ? 'movimiento' : 'movimientos'}</span>
          <span class="cat-amount">${money(r.value)}</span>
          <span class="cat-meta"><span>Del gasto del mes</span><strong>${pct.toFixed(0)} %</strong></span>
          <span class="bar"><span style="width:${pct}%"></span></span>
          ${i === 0 ? '<span class="pill">Mayor gasto</span>' : ''}
        </button>`;
      })
      .join('');
  }

  // ---------- Tabla de movimientos ----------
  function renderTable(expenses) {
    const body = $('txBody');
    const q = ui.search.trim().toLowerCase();
    const filtered = expenses
      .filter((e) => !ui.catFilter || e.category === ui.catFilter)
      .filter((e) => !q || e.desc.toLowerCase().includes(q) || e.method.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);

    const dateFmt = new Intl.DateTimeFormat(U.LOCALE, { day: '2-digit', month: 'short' });
    body.innerHTML = filtered
      .map((e) => {
        const cat = CATEGORY_BY_ID[e.category];
        const desc = U.escapeHtml(e.desc);
        return `<tr data-id="${e.id}" class="${ui.editingId === e.id ? 'editing' : ''}">
          <td class="date">${dateFmt.format(U.parseDate(e.date))}</td>
          <td class="desc" title="${desc}">${desc}</td>
          <td><span class="cat-cell" style="--c:${cat.color}"><span class="cat-mini">${U.icon(cat.icon, 14)}</span>${cat.name}</span></td>
          <td class="method hide-sm">${U.escapeHtml(e.method)}</td>
          <td class="num">${money(e.amount)}</td>
          <td><div class="row-actions">
            <button type="button" class="edit" aria-label="Editar ${desc}" title="Editar">${U.icon('pencil', 16)}</button>
            <button type="button" class="del" aria-label="Eliminar ${desc}" title="Eliminar">${U.icon('trash', 16)}</button>
          </div></td>
        </tr>`;
      })
      .join('');

    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const note = filtered.length !== expenses.length ? ` (filtrados de ${expenses.length})` : '';
    $('listSummary').textContent = expenses.length
      ? `${filtered.length} ${filtered.length === 1 ? 'movimiento' : 'movimientos'}${note} · ${money(total)}`
      : 'Sin movimientos';
    $('emptyState').hidden = expenses.length > 0;
    document.querySelector('.tx-table').hidden = expenses.length === 0;
  }

  // ---------- Formulario ----------
  function defaultDate() {
    return month() === U.monthKey(U.today) ? U.isoDate(U.today) : `${month()}-01`;
  }

  function resetForm() {
    ui.editingId = null;
    $('expenseForm').reset();
    $('fDate').value = defaultDate();
    $('formTitle').textContent = 'Nuevo gasto';
    $('formSubmit').textContent = 'Agregar gasto';
    $('formCancel').hidden = true;
  }

  function startEdit(id) {
    const e = Store.get(id);
    if (!e) return;
    ui.editingId = id;
    $('fDesc').value = e.desc;
    $('fAmount').value = e.amount;
    $('fDate').value = e.date;
    $('fCategory').value = e.category;
    $('fMethod').value = e.method;
    $('formTitle').textContent = 'Editar gasto';
    $('formSubmit').textContent = 'Guardar cambios';
    $('formCancel').hidden = false;
    $('expenseCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('fDesc').focus();
    render();
  }

  function onSubmit(evt) {
    evt.preventDefault();
    const amount = Number($('fAmount').value);
    if (!(amount > 0)) {
      $('fAmount').focus();
      return;
    }
    const data = {
      desc: $('fDesc').value.trim() || 'Sin descripción',
      amount,
      date: $('fDate').value || defaultDate(),
      category: $('fCategory').value,
      method: $('fMethod').value,
    };
    if (ui.editingId) {
      Store.update(ui.editingId, data);
      U.toast('Gasto actualizado');
    } else {
      Store.add(data);
      const target = data.date.slice(0, 7);
      U.toast(target === month() ? `Gasto agregado: ${money(amount)}` : `Gasto agregado a ${U.monthName(target)}`);
    }
    const { category, method } = data;
    resetForm();
    $('fCategory').value = category;
    $('fMethod').value = method;
    render();
  }

  function onTableClick(evt) {
    const btn = evt.target.closest('button');
    const id = btn?.closest('tr')?.dataset.id;
    if (!id) return;
    if (btn.classList.contains('edit')) startEdit(id);
    if (btn.classList.contains('del')) {
      const removed = Store.remove(id);
      if (ui.editingId === id) resetForm();
      render();
      if (removed) {
        U.toast(`Se eliminó "${removed.desc}"`, {
          label: 'Deshacer',
          run() {
            Store.restore(removed);
            render();
          },
        });
      }
    }
  }

  // ---------- Presupuesto ----------
  function toggleBudgetForm(show) {
    $('budgetForm').hidden = !show;
    $('editBudgetBtn').hidden = show;
    $('kpiBudget').hidden = show;
    if (show) {
      $('budgetInput').value = Store.budget(month()) || '';
      $('budgetInput').focus();
      $('budgetInput').select();
    }
  }

  /** Recibe un monto desde la calculadora. */
  function fillAmount(v) {
    $('fAmount').value = v.toFixed(2);
    $('expenseCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    ($('fDesc').value ? $('fAmount') : $('fDesc')).focus();
  }

  function onMonthChanged() {
    toggleBudgetForm(false);
    if (!ui.editingId) $('fDate').value = defaultDate();
  }

  function init() {
    const catOptions = CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    $('fCategory').innerHTML = catOptions;
    $('catFilter').insertAdjacentHTML('beforeend', catOptions);
    $('fDate').value = defaultDate();

    $('expenseForm').addEventListener('submit', onSubmit);
    $('formCancel').addEventListener('click', () => {
      resetForm();
      render();
    });
    $('txBody').addEventListener('click', onTableClick);
    $('searchInput').addEventListener('input', (e) => {
      ui.search = e.target.value;
      render();
    });
    $('catFilter').addEventListener('change', (e) => {
      ui.catFilter = e.target.value;
      render();
    });
    $('catChart').addEventListener('click', (e) => {
      const card = e.target.closest('[data-cat]');
      if (!card) return;
      ui.catFilter = ui.catFilter === card.dataset.cat ? '' : card.dataset.cat;
      $('catFilter').value = ui.catFilter;
      render();
    });

    $('editBudgetBtn').addEventListener('click', () => toggleBudgetForm(true));
    $('budgetForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Number($('budgetInput').value);
      if (Number.isFinite(v) && v >= 0) Store.setBudget(month(), v);
      toggleBudgetForm(false);
      render();
    });
    $('budgetInput').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleBudgetForm(false);
    });
  }

  return { init, render, resetForm, fillAmount, onMonthChanged };
})();
