/* Persistencia local de gastos, presupuestos, metas de ahorro y ajustes. */
const CATEGORIES = [
  { id: 'vivienda', name: 'Vivienda', color: 'var(--s1)', icon: 'home' },
  { id: 'alimentacion', name: 'Alimentación', color: 'var(--s2)', icon: 'cart' },
  { id: 'transporte', name: 'Transporte', color: 'var(--s3)', icon: 'car' },
  { id: 'servicios', name: 'Servicios', color: 'var(--s4)', icon: 'bolt' },
  { id: 'entretenimiento', name: 'Entretenimiento', color: 'var(--s5)', icon: 'play' },
  { id: 'salud', name: 'Salud', color: 'var(--s6)', icon: 'heart' },
  { id: 'educacion', name: 'Educación', color: 'var(--s7)', icon: 'book' },
  { id: 'otros', name: 'Otros', color: 'var(--s8)', icon: 'dots' },
];
const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const GOAL_ICONS = ['🛡️', '🏖️', '✈️', '🏠', '🚗', '💻', '🎓', '💍', '🎁', '💰'];
const GOAL_COLORS = ['var(--s7)', 'var(--s1)', 'var(--s5)', 'var(--s3)', 'var(--s2)', 'var(--s6)'];

const Store = (() => {
  const KEY = 'misFinanzas.v1';
  const defaults = () => ({
    settings: { currency: 'MXN', ivaRate: 16, theme: 'auto' },
    budgets: {},
    expenses: [],
    goals: [],
    savings: [],
  });

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return normalize(JSON.parse(raw));
    } catch (err) {
      console.warn('No se pudieron leer los datos guardados', err);
      // Conserva una copia antes de que el siguiente guardado la reemplace
      try {
        if (raw) localStorage.setItem(`${KEY}.respaldo-${Date.now()}`, raw);
      } catch {
        /* sin almacenamiento disponible */
      }
      return defaults();
    }
  }

  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);

  function normalize(data) {
    const base = defaults();
    if (!data || typeof data !== 'object') return base;
    const list = (v) => (Array.isArray(v) ? v : []);
    const goals = list(data.goals)
      .filter((g) => g && Number(g.target) > 0)
      .map((g) => ({
        id: String(g.id || uid()),
        name: String(g.name || 'Meta').slice(0, 40),
        target: round2(Number(g.target)),
        deadline: isDate(g.deadline) ? g.deadline.slice(0, 10) : '',
        icon: GOAL_ICONS.includes(g.icon) ? g.icon : GOAL_ICONS[GOAL_ICONS.length - 1],
        color: Number.isInteger(g.color) ? g.color % GOAL_COLORS.length : 0,
        createdAt: isDate(g.createdAt) ? g.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
      }));
    const goalIds = new Set(goals.map((g) => g.id));
    return {
      settings: { ...base.settings, ...(data.settings || {}) },
      budgets: data.budgets && typeof data.budgets === 'object' ? data.budgets : {},
      expenses: list(data.expenses)
        .filter((e) => e && isDate(e.date) && Number.isFinite(Number(e.amount)))
        .map((e) => ({
          id: String(e.id || uid()),
          desc: String(e.desc || 'Sin descripción').slice(0, 80),
          amount: round2(Number(e.amount)),
          category: CATEGORY_BY_ID[e.category] ? e.category : 'otros',
          date: e.date.slice(0, 10),
          method: String(e.method || 'Efectivo'),
        })),
      goals,
      savings: list(data.savings)
        .filter((s) => s && goalIds.has(String(s.goalId)) && isDate(s.date) && Number.isFinite(Number(s.amount)))
        .map((s) => ({
          id: String(s.id || uid()),
          goalId: String(s.goalId),
          amount: round2(Number(s.amount)),
          date: s.date.slice(0, 10),
          note: String(s.note || '').slice(0, 60),
        })),
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('No se pudieron guardar los datos', err);
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // Se carga al final, cuando todas las funciones auxiliares ya existen
  let state = load();

  return {
    round2,
    settings: () => state.settings,
    setSettings(patch) {
      state.settings = { ...state.settings, ...patch };
      save();
    },

    /** Presupuesto del mes; si no hay, hereda el último definido antes de ese mes. */
    budget(monthKey) {
      if (state.budgets[monthKey] != null) return state.budgets[monthKey];
      const prior = Object.keys(state.budgets).filter((k) => k < monthKey).sort();
      return prior.length ? state.budgets[prior[prior.length - 1]] : 0;
    },
    setBudget(monthKey, value) {
      state.budgets[monthKey] = round2(Math.max(0, value));
      save();
    },

    // ----- Gastos -----
    expensesFor(monthKey) {
      return state.expenses.filter((e) => e.date.slice(0, 7) === monthKey);
    },
    get(id) {
      return state.expenses.find((e) => e.id === id);
    },
    add(expense) {
      const item = { ...expense, id: uid(), amount: round2(expense.amount) };
      state.expenses.push(item);
      save();
      return item;
    },
    addMany(list) {
      list.forEach((e) => state.expenses.push({ ...e, id: uid(), amount: round2(e.amount) }));
      save();
    },
    update(id, patch) {
      const item = state.expenses.find((e) => e.id === id);
      if (!item) return;
      Object.assign(item, patch, { amount: round2(patch.amount ?? item.amount) });
      save();
    },
    remove(id) {
      const i = state.expenses.findIndex((e) => e.id === id);
      if (i < 0) return null;
      const [removed] = state.expenses.splice(i, 1);
      save();
      return removed;
    },
    restore(item) {
      state.expenses.push(item);
      save();
    },

    // ----- Metas de ahorro -----
    goals: () => state.goals.slice(),
    goal: (id) => state.goals.find((g) => g.id === id),
    addGoal(goal) {
      const item = { ...goal, id: uid(), target: round2(goal.target), createdAt: goal.createdAt || new Date().toISOString().slice(0, 10) };
      state.goals.push(item);
      save();
      return item;
    },
    updateGoal(id, patch) {
      const g = state.goals.find((x) => x.id === id);
      if (!g) return;
      Object.assign(g, patch, { target: round2(patch.target ?? g.target) });
      save();
    },
    /** Elimina la meta junto con sus movimientos; devuelve lo necesario para deshacer. */
    removeGoal(id) {
      const i = state.goals.findIndex((g) => g.id === id);
      if (i < 0) return null;
      const [goal] = state.goals.splice(i, 1);
      const movements = state.savings.filter((s) => s.goalId === id);
      state.savings = state.savings.filter((s) => s.goalId !== id);
      save();
      return { goal, movements };
    },
    restoreGoal({ goal, movements }) {
      state.goals.push(goal);
      state.savings.push(...movements);
      save();
    },

    savings: () => state.savings.slice(),
    savedFor: (goalId) => round2(state.savings.filter((s) => s.goalId === goalId).reduce((t, s) => t + s.amount, 0)),
    addSaving(mov) {
      const item = { ...mov, id: uid(), amount: round2(mov.amount) };
      state.savings.push(item);
      save();
      return item;
    },
    addSavingsMany(list) {
      list.forEach((m) => state.savings.push({ ...m, id: uid(), amount: round2(m.amount) }));
      save();
    },
    removeSaving(id) {
      const i = state.savings.findIndex((s) => s.id === id);
      if (i < 0) return null;
      const [removed] = state.savings.splice(i, 1);
      save();
      return removed;
    },
    restoreSaving(item) {
      state.savings.push(item);
      save();
    },

    // ----- Respaldo -----
    exportData: () => JSON.parse(JSON.stringify(state)),
    importData(data) {
      if (!data || !Array.isArray(data.expenses)) throw new Error('El archivo no es un respaldo válido.');
      state = normalize(data);
      save();
    },
    reset() {
      const { currency, ivaRate, theme } = state.settings;
      state = defaults();
      state.settings = { currency, ivaRate, theme };
      save();
    },
  };
})();
