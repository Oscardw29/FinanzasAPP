/* Página de ahorro: metas, aportes/retiros, evolución del ahorro y lo que sobra del presupuesto. */
const Savings = (() => {
  const { $, money, compact, escapeHtml } = U;
  const ui = { editingId: null, filter: 'active', icon: GOAL_ICONS[0], color: 0 };
  const month = () => U.state.month;
  const todayIso = () => U.isoDate(U.today);

  function goalStats() {
    return Store.goals().map((g) => {
      const saved = Store.savedFor(g.id);
      return { ...g, saved, done: saved >= g.target, pct: Math.min(100, (saved / g.target) * 100) };
    });
  }

  function render() {
    const goals = goalStats();
    renderHero(goals);
    renderTiles(goals);
    renderGoals(goals);
    renderGoalSelect(goals);
    renderActivity();
  }

  // ---------- Resumen superior ----------
  function renderHero(goals) {
    const all = Store.savings();
    const total = Store.round2(all.reduce((s, m) => s + m.amount, 0));
    const target = goals.reduce((s, g) => s + g.target, 0);
    const key = month();
    const inMonth = (k) => all.filter((m) => m.date.slice(0, 7) === k).reduce((s, m) => s + m.amount, 0);
    const thisMonth = Store.round2(inMonth(key));
    const prevMonth = inMonth(U.shiftMonth(key, -1));
    const active = goals.filter((g) => !g.done).length;
    const done = goals.length - active;

    $('saveTotal').textContent = money(total);
    $('saveChip').textContent = goals.length ? `${active} ${active === 1 ? 'activa' : 'activas'} · ${done} ${done === 1 ? 'lograda' : 'logradas'}` : 'Sin metas';
    $('saveTarget').textContent = target ? money(target) : '—';
    $('saveProgress').textContent = target ? `${Math.min(100, (goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0) / target) * 100).toFixed(0)} %` : '—';
    $('saveMonthLabel').textContent = `Ahorrado en ${U.monthName(key, false)}`;
    $('saveMonth').textContent = money(thisMonth);
    $('saveMonthSub').innerHTML = prevMonth
      ? `<span class="delta ${thisMonth >= prevMonth ? 'down' : 'up'}">${thisMonth >= prevMonth ? '▲' : '▼'} ${money(Math.abs(thisMonth - prevMonth))}</span> vs. ${U.monthName(U.shiftMonth(key, -1), false)}`
      : '';

    // Evolución: saldo acumulado al cierre de cada mes
    const container = $('saveChart');
    if (!all.length) {
      container.innerHTML = '<div class="chart-empty">Tus aportes aparecerán aquí mes con mes</div>';
      return;
    }
    const first = all.map((m) => m.date.slice(0, 7)).sort()[0];
    let start = U.shiftMonth(key, -11);
    if (first > start) start = first;
    const months = [];
    for (let k = start; k <= key; k = U.shiftMonth(k, 1)) months.push(k);
    while (months.length < 6) months.unshift(U.shiftMonth(months[0], -1));
    const current = U.monthKey(U.today);
    const values = months.map((k) =>
      k > current ? null : Store.round2(all.filter((m) => m.date.slice(0, 7) <= k).reduce((s, m) => s + m.amount, 0)));
    const contributions = months.map(inMonth);

    Charts.line(container, {
      labels: months,
      xLabel: (i) => U.shortMonth(months[i]),
      series: [{ name: 'Ahorro acumulado', values, color: '#ffffff', area: true, endDot: true }],
      height: container.clientWidth < 500 ? 170 : 190,
      ariaLabel: 'Ahorro acumulado por mes',
      formatAxis: compact,
      formatEnd: money,
      tooltip(i) {
        const net = contributions[i];
        return `<div class="tt-title">${U.monthName(months[i])}</div>
          <div class="tt-row"><span class="tt-key"><span class="dot" style="background:var(--primary)"></span>Ahorro acumulado</span><span class="tt-val">${values[i] == null ? '—' : money(values[i])}</span></div>
          <div class="tt-row"><span class="tt-key">Movimiento del mes</span><span class="tt-val">${net >= 0 ? '+' : '−'} ${money(Math.abs(net))}</span></div>`;
      },
    });
  }

  function leftover() {
    const key = month();
    const budget = Store.budget(key);
    const spent = Store.expensesFor(key).reduce((s, e) => s + e.amount, 0);
    return { budget, value: Store.round2(budget - spent) };
  }

  function renderTiles(goals) {
    const { budget, value } = leftover();
    const btn = $('leftoverBtn');
    $('leftoverLabel').textContent = `Te sobra en ${U.monthName(month(), false)}`;
    if (!budget) {
      $('leftoverValue').textContent = '—';
      $('leftoverSub').textContent = 'Define un presupuesto en Resumen para calcularlo';
      btn.hidden = true;
    } else if (value <= 0) {
      $('leftoverValue').textContent = money(value);
      $('leftoverSub').textContent = value < 0 ? 'Gastaste más que tu presupuesto este mes' : 'Usaste todo tu presupuesto';
      btn.hidden = true;
    } else {
      $('leftoverValue').textContent = money(value);
      $('leftoverSub').textContent = 'De tu presupuesto sin gastar';
      btn.hidden = false;
      btn.textContent = goals.some((g) => !g.done) ? 'Mover a una meta' : 'Crear una meta';
    }

    const upcoming = goals
      .filter((g) => !g.done && g.deadline)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    if (!upcoming) {
      $('nextDeadline').textContent = 'Sin fechas';
      $('nextDeadlineSub').textContent = 'Agrega una fecha límite a tus metas';
    } else {
      const days = U.daysBetween(todayIso(), upcoming.deadline);
      $('nextDeadline').textContent = `${upcoming.icon} ${upcoming.name}`;
      $('nextDeadlineSub').textContent = days < 0
        ? `Venció hace ${-days} días · faltan ${money(upcoming.target - upcoming.saved)}`
        : `${days === 0 ? 'Vence hoy' : `En ${days} ${days === 1 ? 'día' : 'días'}`} · faltan ${money(upcoming.target - upcoming.saved)}`;
    }
  }

  // ---------- Tarjetas de metas ----------
  function timeLabel(g) {
    if (g.done) return { text: '¡Meta lograda!', cls: 'good' };
    if (!g.deadline) return { text: 'Sin fecha límite', cls: '' };
    const days = U.daysBetween(todayIso(), g.deadline);
    if (days < 0) return { text: 'Fecha vencida', cls: 'critical' };
    if (days === 0) return { text: 'Vence hoy', cls: 'warning' };
    if (days <= 60) return { text: `${days} ${days === 1 ? 'día restante' : 'días restantes'}`, cls: days <= 14 ? 'warning' : '' };
    return { text: `≈ ${Math.round(days / 30)} meses`, cls: '' };
  }

  function monthlyHint(g) {
    if (g.done) return `Ahorraste ${money(g.saved)} 🎉`;
    const remaining = g.target - g.saved;
    if (!g.deadline) return `Te faltan ${money(remaining)}`;
    const days = U.daysBetween(todayIso(), g.deadline);
    if (days < 0) return `Te faltan ${money(remaining)}; define una nueva fecha`;
    const months = Math.max(1, Math.ceil(days / 30.44));
    return `Ahorra ${money(remaining / months)} al mes para lograrlo`;
  }

  function renderGoals(goals) {
    const grid = $('goalsGrid');
    const visible = goals
      .filter((g) => (ui.filter === 'all' ? true : ui.filter === 'done' ? g.done : !g.done))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.deadline || '9999').localeCompare(b.deadline || '9999'));

    const active = goals.filter((g) => !g.done).length;
    $('goalsSummary').textContent = goals.length
      ? `${goals.length} ${goals.length === 1 ? 'meta' : 'metas'} · ${active} en progreso`
      : 'Crea metas y registra tus aportes';

    grid.innerHTML = visible
      .map((g) => {
        const t = timeLabel(g);
        const deadline = g.deadline
          ? `Para el ${new Intl.DateTimeFormat(U.LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(U.parseDate(g.deadline))}`
          : 'Sin fecha límite';
        const name = escapeHtml(g.name);
        return `<article class="card glass goal-card${g.done ? ' done' : ''}" data-goal="${g.id}" style="--c:${GOAL_COLORS[g.color]}">
          <span class="goal-badge" aria-hidden="true">${g.icon}</span>
          <div class="goal-menu">
            <button type="button" data-act="edit" aria-label="Editar ${name}" title="Editar">${U.icon('pencil', 16)}</button>
            <button type="button" data-act="delete" aria-label="Eliminar ${name}" title="Eliminar">${U.icon('trash', 16)}</button>
          </div>
          <h3 class="goal-name">${name}</h3>
          <p class="goal-sub">${deadline}</p>
          <div class="goal-progress"><span>Progreso</span><strong>${g.pct.toFixed(0)} %</strong></div>
          <div class="bar goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(g.pct)}" aria-label="Progreso de ${name}"><span style="width:${g.pct}%"></span></div>
          <div class="goal-foot">
            <span class="goal-amounts"><strong>${money(g.saved)}</strong> / ${money(g.target)}</span>
            <span class="pill ${t.cls}">${t.text}</span>
          </div>
          <p class="goal-hint">${monthlyHint(g)}</p>
          <div class="goal-actions">
            <button type="button" class="btn primary sm" data-act="in">${U.icon('plus', 16)} Aportar</button>
            <button type="button" class="btn ghost sm" data-act="out"${g.saved > 0 ? '' : ' disabled'}>${U.icon('minus', 16)} Retirar</button>
          </div>
        </article>`;
      })
      .join('');

    const empty = $('goalsEmpty');
    empty.hidden = visible.length > 0;
    $('goalSampleBtn').hidden = goals.length > 0;
    if (!goals.length) {
      $('goalsEmptyTitle').textContent = 'Todavía no tienes metas de ahorro.';
      $('goalsEmptyText').textContent = 'Crea tu primera meta en el panel: un fondo de emergencia, un viaje o lo que quieras lograr.';
    } else if (ui.filter === 'done') {
      $('goalsEmptyTitle').textContent = 'Aún no completas ninguna meta.';
      $('goalsEmptyText').textContent = 'Cuando llegues al monto objetivo de una meta, aparecerá aquí.';
    } else {
      $('goalsEmptyTitle').textContent = '¡Completaste todas tus metas!';
      $('goalsEmptyText').textContent = 'Crea una nueva meta en el panel para seguir ahorrando.';
    }
  }

  function renderGoalSelect(goals) {
    const select = $('sGoal');
    const prev = select.value;
    select.innerHTML = goals.length
      ? goals.map((g) => `<option value="${g.id}">${g.icon} ${escapeHtml(g.name)} · ${money(g.saved)}</option>`).join('')
      : '<option value="">Primero crea una meta</option>';
    if (goals.some((g) => g.id === prev)) select.value = prev;
    $('savingSubmit').disabled = !goals.length;
  }

  function renderActivity() {
    const list = $('activityList');
    const items = Store.savings()
      .map((m, i) => ({ ...m, i }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i)
      .slice(0, 8);
    if (!items.length) {
      list.innerHTML = '<li class="activity-empty muted">Tus aportes y retiros aparecerán aquí</li>';
      return;
    }
    list.innerHTML = items
      .map((m) => {
        const g = Store.goal(m.goalId);
        const isIn = m.amount >= 0;
        const note = m.note ? ` · ${escapeHtml(m.note)}` : '';
        return `<li data-id="${m.id}">
          <span class="act-badge" style="--c:${GOAL_COLORS[g.color]}">${g.icon}</span>
          <div class="act-text">
            <strong>${isIn ? 'Aporte a' : 'Retiro de'} ${escapeHtml(g.name)}</strong>
            <span class="muted">${U.relativeDay(m.date)}${note}</span>
          </div>
          <span class="act-amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'}${money(Math.abs(m.amount))}</span>
          <button type="button" class="act-del" aria-label="Eliminar movimiento" title="Eliminar">${U.icon('trash', 15)}</button>
        </li>`;
      })
      .join('');
  }

  // ---------- Formulario de aporte/retiro ----------
  const savingType = () => document.querySelector('input[name="savingType"]:checked').value;

  function defaultDate() {
    return month() === U.monthKey(U.today) ? todayIso() : `${month()}-01`;
  }

  function setSavingType(type) {
    document.querySelector(`input[name="savingType"][value="${type}"]`).checked = true;
    $('savingSubmit').textContent = type === 'in' ? 'Aportar a la meta' : 'Retirar de la meta';
  }

  function onSavingSubmit(evt) {
    evt.preventDefault();
    const goalId = $('sGoal').value;
    const goal = Store.goal(goalId);
    const amount = Store.round2(Number($('sAmount').value));
    if (!goal) return;
    if (!(amount > 0)) {
      $('sAmount').focus();
      return;
    }
    const type = savingType();
    const before = Store.savedFor(goalId);
    if (type === 'out' && amount > before) {
      U.toast(`Solo tienes ${money(before)} en «${goal.name}»`);
      $('sAmount').focus();
      return;
    }
    Store.addSaving({
      goalId,
      amount: type === 'in' ? amount : -amount,
      date: $('sDate').value || defaultDate(),
      note: $('sNote').value.trim(),
    });
    const after = Store.savedFor(goalId);
    if (type === 'in' && before < goal.target && after >= goal.target) {
      U.toast(`🎉 ¡Lograste tu meta «${goal.name}»!`);
    } else {
      U.toast(type === 'in' ? `Aportaste ${money(amount)} a «${goal.name}»` : `Retiraste ${money(amount)} de «${goal.name}»`);
    }
    $('sAmount').value = '';
    $('sNote').value = '';
    render();
  }

  function prepareMovement(goalId, type) {
    setSavingType(type);
    $('sGoal').value = goalId;
    $('savingCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('sAmount').focus();
  }

  // ---------- Formulario de meta ----------
  function drawPickers() {
    $('gIcons').innerHTML = GOAL_ICONS.map((ic) =>
      `<button type="button" role="radio" class="pick-icon${ic === ui.icon ? ' active' : ''}" aria-checked="${ic === ui.icon}" data-icon-value="${ic}">${ic}</button>`).join('');
    $('gColors').innerHTML = GOAL_COLORS.map((c, i) =>
      `<button type="button" role="radio" class="pick-color${i === ui.color ? ' active' : ''}" aria-checked="${i === ui.color}" aria-label="Color ${i + 1}" data-color="${i}" style="--c:${c}"></button>`).join('');
  }

  function resetGoalForm() {
    ui.editingId = null;
    ui.icon = GOAL_ICONS[0];
    ui.color = 0;
    $('goalForm').reset();
    $('goalFormTitle').textContent = 'Nueva meta';
    $('goalSubmit').textContent = 'Crear meta';
    $('goalCancel').hidden = true;
    drawPickers();
  }

  function startEditGoal(id) {
    const g = Store.goal(id);
    if (!g) return;
    ui.editingId = id;
    ui.icon = g.icon;
    ui.color = g.color;
    $('gName').value = g.name;
    $('gTarget').value = g.target;
    $('gDeadline').value = g.deadline;
    $('goalFormTitle').textContent = 'Editar meta';
    $('goalSubmit').textContent = 'Guardar cambios';
    $('goalCancel').hidden = false;
    drawPickers();
    $('goalCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('gName').focus();
  }

  function onGoalSubmit(evt) {
    evt.preventDefault();
    const target = Number($('gTarget').value);
    if (!(target > 0)) {
      $('gTarget').focus();
      return;
    }
    const data = {
      name: $('gName').value.trim() || 'Mi meta',
      target,
      deadline: $('gDeadline').value || '',
      icon: ui.icon,
      color: ui.color,
    };
    if (ui.editingId) {
      Store.updateGoal(ui.editingId, data);
      U.toast('Meta actualizada');
    } else {
      const g = Store.addGoal(data);
      $('sGoal').dataset.pending = g.id;
      U.toast(`Meta «${g.name}» creada. ¡Haz tu primer aporte!`);
    }
    resetGoalForm();
    render();
    if ($('sGoal').dataset.pending) {
      $('sGoal').value = $('sGoal').dataset.pending;
      delete $('sGoal').dataset.pending;
    }
  }

  function onGoalsClick(evt) {
    const btn = evt.target.closest('button[data-act]');
    const id = btn?.closest('[data-goal]')?.dataset.goal;
    if (!id) return;
    const act = btn.dataset.act;
    if (act === 'in' || act === 'out') prepareMovement(id, act);
    if (act === 'edit') startEditGoal(id);
    if (act === 'delete') {
      const removed = Store.removeGoal(id);
      if (ui.editingId === id) resetGoalForm();
      render();
      if (removed) {
        U.toast(`Se eliminó la meta «${removed.goal.name}»`, {
          label: 'Deshacer',
          run() {
            Store.restoreGoal(removed);
            render();
          },
        });
      }
    }
  }

  // ---------- Datos de ejemplo ----------
  function loadSample() {
    const cur = U.monthKey(U.today);
    const dayIn = (k, d) => `${k}-${String(k === cur ? Math.min(d, U.today.getDate()) : d).padStart(2, '0')}`;
    const inMonths = (n) => {
      const d = new Date(U.today);
      d.setMonth(d.getMonth() + n);
      return U.isoDate(d);
    };
    const goals = [
      { name: 'Fondo de emergencia', target: 30000, deadline: '', icon: '🛡️', color: 0, plan: [2000, 2000, 2000, 2000, 2000, 2000] },
      { name: 'Viaje a la playa', target: 15000, deadline: inMonths(4), icon: '🏖️', color: 1, plan: [0, 1500, 1500, 1500, 1500, 1500] },
      { name: 'Laptop nueva', target: 22000, deadline: inMonths(8), icon: '💻', color: 2, plan: [0, 0, 3000, 2500, 0, 4000] },
      { name: 'Curso de inglés', target: 4800, deadline: inMonths(-1), icon: '🎓', color: 3, plan: [2400, 2400, 0, 0, 0, 0] },
    ];
    goals.forEach(({ plan, ...g }) => {
      const created = Store.addGoal({ ...g, createdAt: dayIn(U.shiftMonth(cur, -5), 1) });
      const moves = plan
        .map((amount, i) => ({ amount, k: U.shiftMonth(cur, i - 5) }))
        .filter((p) => p.amount)
        .map((p) => ({ goalId: created.id, amount: p.amount, date: dayIn(p.k, 15), note: '' }));
      Store.addSavingsMany(moves);
    });
    Store.addSaving({ goalId: Store.goals().find((g) => g.name === 'Viaje a la playa').id, amount: -500, date: dayIn(U.shiftMonth(cur, -1), 20), note: 'Reservación de hotel' });
    render();
    U.toast('Se cargaron metas de ejemplo. Puedes eliminarlas cuando quieras.');
  }

  /** Recibe un monto desde la calculadora o desde «lo que te sobra». */
  function fillAmount(v) {
    if (!Store.goals().length) {
      $('goalCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      $('gName').focus();
      U.toast('Primero crea una meta para poder ahorrar en ella');
      return;
    }
    setSavingType('in');
    $('sAmount').value = v.toFixed(2);
    $('savingCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('sGoal').focus();
  }

  function onMonthChanged() {
    $('sDate').value = defaultDate();
  }

  function init() {
    drawPickers();
    $('sDate').value = defaultDate();
    document.querySelectorAll('input[name="savingType"]').forEach((r) =>
      r.addEventListener('change', () => setSavingType(r.value)));
    document.querySelectorAll('input[name="goalFilter"]').forEach((r) =>
      r.addEventListener('change', () => {
        ui.filter = r.value;
        render();
      }));
    $('savingForm').addEventListener('submit', onSavingSubmit);
    $('goalForm').addEventListener('submit', onGoalSubmit);
    $('goalCancel').addEventListener('click', resetGoalForm);
    $('goalsGrid').addEventListener('click', onGoalsClick);
    $('goalSampleBtn').addEventListener('click', loadSample);
    $('gIcons').addEventListener('click', (e) => {
      const b = e.target.closest('[data-icon-value]');
      if (!b) return;
      ui.icon = b.dataset.iconValue;
      drawPickers();
    });
    $('gColors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      ui.color = Number(b.dataset.color);
      drawPickers();
    });
    $('leftoverBtn').addEventListener('click', () => fillAmount(leftover().value));
    $('activityList').addEventListener('click', (e) => {
      const b = e.target.closest('.act-del');
      const id = b?.closest('li')?.dataset.id;
      if (!id) return;
      const removed = Store.removeSaving(id);
      render();
      if (removed) {
        U.toast('Movimiento eliminado', {
          label: 'Deshacer',
          run() {
            Store.restoreSaving(removed);
            render();
          },
        });
      }
    });
  }

  return { init, render, fillAmount, onMonthChanged };
})();
