// Estado do jogo e persistência.
// Toda leitura e escrita de save passa por aqui: trocar localStorage por IndexedDB no futuro
// só exige mudar este arquivo.

const KEY = 'green.save';
export const SAVE_VERSION = 4;

export function defaultState() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    operator: null,
    xp: 0,
    reputation: 50,
    nodes: {},        // id -> { level, cooldownUntil, attempts, provenAt: {1: ts, 2: ts, 3: ts} }
    missions: {},     // id -> { completions, best, lastAt }
    battles: {},      // legado da 0.2 (incidentes fixos)
    run: null,        // operação em andamento (modo roguelike), objeto serializável de run.js
    runs: [],         // histórico das últimas operações
    bestiary: {},     // id do monstro/chefe -> { met, beaten }
    maxThreat: 0,     // maior nível de ameaça liberado
    areaXp: {},       // ramo -> XP de área ganho respondendo cartas nas operações (soma-se ao dos nós)
    rust: {},         // nodeId -> ts: nó comprovado que você errou numa análise ou caso, até acertar de novo
    history: [],      // { q, ok, t, kind } — base para revisão espaçada
    stats: { exams: 0, passed: 0, missions: 0, missionsFailed: 0, battles: 0, battlesWon: 0, cards: 0, cardsOk: 0, runs: 0, runsWon: 0 },
    settings: { timer: 90, cooldownHours: 24, effects: true, sound: true },
    activeExam: null,
  };
}

let state = null;
const listeners = new Set();

function merge(base, data) {
  // Preenche chaves ausentes no save com os valores padrão, sem apagar o que existe.
  for (const [k, v] of Object.entries(base)) {
    if (!(k in data)) data[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && data[k] && typeof data[k] === 'object') merge(v, data[k]);
  }
  return data;
}

function migrate(data) {
  if (!data || typeof data !== 'object' || typeof data.version !== 'number') {
    throw new Error('Arquivo de save inválido.');
  }
  if (data.version > SAVE_VERSION) {
    throw new Error(`Save da versão ${data.version}, mais nova que este jogo (${SAVE_VERSION}).`);
  }
  if (data.version === 1) {
    // 0.2: incidentes. Os campos novos são preenchidos pelo merge; aqui só marcamos a versão.
    data.version = 2;
  }
  if (data.version === 2) {
    // 0.3: operação (roguelike). Também preenchido pelo merge.
    data.version = 3;
  }
  if (data.version === 3) {
    // 0.4: combate por cartas. A operação em andamento da 0.3 não é compatível com o novo combate.
    if (data.run && data.run.v !== 2) {
      data.notice = 'A operação em andamento era da versão 0.3 e foi encerrada pela atualização do combate. O XP já ganho foi mantido.';
      data.run = null;
    }
    delete data.loadout;
    data.version = 4;
  }
  return merge(defaultState(), data);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = migrate(JSON.parse(raw));
  } catch (err) {
    console.warn('[green] não foi possível ler o save:', err);
  }
  if (!state) state = defaultState();
  return state;
}

export function get() { return state; }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (err) { console.warn('[green] não foi possível gravar o save:', err); }
  for (const fn of listeners) fn(state);
}

export function update(fn) { fn(state); save(); }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function nodeEntry(s, id) {
  if (!s.nodes[id]) s.nodes[id] = { level: 0, cooldownUntil: 0, attempts: 0, provenAt: {} };
  return s.nodes[id];
}

export function exportSave() {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `green-save-${state.operator || 'operador'}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importSave(text) {
  const data = migrate(JSON.parse(text));
  data.activeExam = null;
  state = data;
  save();
  return state;
}

export function reset() {
  state = defaultState();
  save();
  return state;
}
