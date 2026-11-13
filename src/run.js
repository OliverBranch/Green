// Operação: o modo roguelike. Três atos, cada um com um mapa procedural de caminhos que terminam num chefe.
//
// Este arquivo é puro: tudo o que ele precisa vem do objeto `data` (catálogos, flashcards, níveis dos nós,
// banco de questões e ferrugem), e todo o estado da operação é um objeto serializável em JSON. A interface
// (ui/run-view.js) chama estas funções e grava o resultado no save; o simulador (tools/sim-run.mjs) as
// chama em laço para balancear.
//
// Os atributos do personagem (ficha do analista, attributes.js) são calculados no início da operação
// e ficam fixos até o fim dela.

import { createBattle, mergeMods, hash } from './battle.js';
import { CARD_XP, CASE_XP } from './attributes.js';

export const ACTS = 3;
export const ROWS = 8;          // andares por ato antes do chefe
export const COLS = 5;
export const PATHS = 5;
export const START_CREDITS = 60;
export const SCRIPT_SLOTS = 3;

export const ACT_NAMES = [null, 'Perímetro', 'Aplicações e nuvem', 'Núcleo'];

// Níveis de ameaça: cada vitória libera o próximo. Os efeitos se acumulam.
export const THREATS = [
  { n: 0, name: 'Plantão normal', text: 'A operação como foi desenhada.' },
  { n: 1, name: 'Elites afiadas', text: 'Elites ganham um mutador a mais.' },
  { n: 2, name: 'Equipe enxuta', text: 'Você começa com 10 de integridade máxima a menos.' },
  { n: 3, name: 'Adversário maduro', text: 'Inimigos causam 25% a mais de dano.' },
  { n: 4, name: 'Ninguém é comum', text: 'Atacantes comuns têm chance maior de mutadores, desde o primeiro ato.' },
  { n: 5, name: 'APT', text: 'Chefes têm 25% a mais de vida e as questões de caso chegam mais cedo.' },
];
export const NODE_TYPES = {
  combat: { name: 'Incidente', icon: 'target', desc: 'Um atacante comum. Créditos e às vezes um script.' },
  elite: { name: 'Elite', icon: 'crown', desc: 'Atacante com mutadores. Mais perigoso, rende uma ferramenta.' },
  event: { name: 'Imprevisto', icon: 'brain', desc: 'Uma situação inesperada com escolhas. Algumas testam seu conhecimento.' },
  rest: { name: 'Plantão', icon: 'heart', desc: 'Descansar ou estudar uma questão de prova.' },
  shop: { name: 'Mercado', icon: 'cert', desc: 'Ferramentas, scripts e manutenção em troca de créditos.' },
  treasure: { name: 'Achado', icon: 'patch', desc: 'Uma ferramenta esquecida no data center.' },
  boss: { name: 'Chefe', icon: 'lock', desc: 'O atacante principal do ato.' },
};

// botões de balanceamento (tools/sim-run.mjs): os valores dos JSON são a base, estes multiplicam por ato
export const HP_MUL = [null, 1.7, 2.35, 3.1];
export const DMG_MUL = [null, 1.75, 2.25, 2.75];
export const BOSS_HP = 1.5;
export const BOSS_DMG = 1.6;
const ELITE_HP = 1.5;
const ELITE_DMG = 1.2;
export const REVIEW_MAX = 30;

// ---------- aleatoriedade persistente ----------
// O estado do gerador fica dentro da operação, então recarregar a página não muda o que vem a seguir.

export function rand(run) {
  let a = run.rng >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  run.rng = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (run, arr) => arr[Math.floor(rand(run) * arr.length)];
const between = (run, lo, hi) => lo + Math.floor(rand(run) * (hi - lo + 1));
function shuffle(run, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(run) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weighted(run, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = rand(run) * total;
  for (const [v, w] of entries) { x -= w; if (x <= 0) return v; }
  return entries[entries.length - 1][0];
}

// ---------- criação ----------

export const RUN_VERSION = 2;

export function newRun({ seed = Date.now(), data, attrs, threat = 0 }) {
  const hp = attrs.hp - (threat >= 2 ? 10 : 0);
  const run = {
    v: RUN_VERSION,
    seed: seed >>> 0,
    rng: (seed ^ 0x9e3779b9) >>> 0,
    startedAt: Date.now(),
    act: 1,
    threat,
    attrs: { ...attrs },
    hp,
    maxHp: hp,
    credits: START_CREDITS,
    relics: [],
    scripts: [],
    hops: attrs.hops || 0,
    bosses: {},
    map: null,
    pos: null,         // id do nó atual
    path: [],          // ids visitados no ato
    status: 'map',
    pending: null,
    seenEvents: [],
    recent: [],
    asked: [],
    review: [],        // flashcards errados nesta operação: voltam nos próximos combates
    recentCards: [],   // vistos há pouco: vão para o fim do baralho
    areaXp: {},        // ramo -> XP de área ganho respondendo cartas
    phoenixUsed: false,
    xp: 0,
    floor: 0,
    stats: { fights: 0, elites: 0, bosses: 0, events: 0, cards: 0, correct: 0, fast: 0, crits: 0, logs: 0, logsOk: 0, cases: 0, casesOk: 0, maxFocus: 0, dmgTaken: 0, topics: {}, misses: {} },
    log: [],
  };
  for (let act = 1; act <= ACTS; act++) {
    const pool = data.bosses.filter((b) => b.act === act);
    run.bosses[act] = pick(run, pool).id;
  }
  run.map = generateMap(run, run.act);
  return run;
}

// ---------- mapa ----------

export function generateMap(run, act) {
  const nodes = {};
  const id = (r, c) => `a${act}r${r}c${c}`;
  const ensure = (r, c) => (nodes[id(r, c)] ||= { id: id(r, c), row: r, col: c, type: null, next: [] });
  const hasEdge = (a, b) => nodes[a]?.next.includes(b);

  const starts = shuffle(run, [...Array(COLS).keys()]);
  for (let w = 0; w < PATHS; w++) {
    let col = w < 3 ? starts[w] : between(run, 0, COLS - 1);
    for (let r = 0; r < ROWS; r++) {
      const here = ensure(r, col);
      if (r === ROWS - 1) break;
      const options = shuffle(run, [col - 1, col, col + 1].filter((c) => c >= 0 && c < COLS));
      let chosen = col;
      for (const nc of options) {
        // não deixa duas trilhas se cruzarem em X
        if (nc !== col && hasEdge(id(r, nc), id(r + 1, col))) continue;
        chosen = nc;
        break;
      }
      const there = ensure(r + 1, chosen);
      if (!here.next.includes(there.id)) here.next.push(there.id);
      col = chosen;
    }
  }
  const boss = { id: `a${act}boss`, row: ROWS, col: Math.floor(COLS / 2), type: 'boss', next: [] };
  for (const n of Object.values(nodes)) if (n.row === ROWS - 1) n.next.push(boss.id);
  nodes[boss.id] = boss;

  // tipos de nó
  const parents = {};
  for (const n of Object.values(nodes)) for (const t of n.next) (parents[t] ||= []).push(n.id);
  const ordered = Object.values(nodes).filter((n) => n.type !== 'boss').sort((a, b) => a.row - b.row || a.col - b.col);
  for (const n of ordered) {
    if (n.row === 0) { n.type = 'combat'; continue; }
    if (n.row === ROWS - 1) { n.type = 'rest'; continue; }
    if (n.row === 4) { n.type = 'treasure'; continue; }
    const parentTypes = (parents[n.id] || []).map((p) => nodes[p].type);
    let type = 'combat';
    for (let tries = 0; tries < 8; tries++) {
      type = weighted(run, [
        ['combat', 46],
        ['event', 24],
        ['elite', n.row >= 3 ? 14 : 0],
        ['rest', n.row >= 3 && n.row <= 5 ? 9 : 0],
        ['shop', n.row >= 2 ? 8 : 0],
      ]);
      if (['elite', 'rest', 'shop'].includes(type) && parentTypes.includes(type)) continue;
      break;
    }
    n.type = type;
  }
  // garante ao menos um mercado e uma elite por ato
  for (const want of ['shop', 'elite']) {
    if (!ordered.some((n) => n.type === want)) {
      const cand = ordered.filter((n) => n.row >= 3 && n.row <= 6 && (n.type === 'combat' || n.type === 'event'));
      if (cand.length) pick(run, cand).type = want;
    }
  }
  return { act, nodes, start: ordered.filter((n) => n.row === 0).map((n) => n.id), boss: boss.id };
}

export function reachable(run) {
  if (run.status !== 'map') return [];
  if (!run.pos) return run.map.start.slice();
  return run.map.nodes[run.pos]?.next.slice() || [];
}

// Saltos laterais (atributo Banda, ramo Redes): ir para um nó do andar seguinte que não está ligado ao atual.
export function hopTargets(run) {
  if (run.status !== 'map' || !run.pos || (run.hops || 0) <= 0) return [];
  const here = run.map.nodes[run.pos];
  if (!here || here.row >= ROWS - 1) return [];
  return Object.values(run.map.nodes)
    .filter((n) => n.row === here.row + 1 && !here.next.includes(n.id) && Math.abs(n.col - here.col) <= 2)
    .map((n) => n.id);
}

// ---------- ferramentas ----------

export function relicMods(run, data) {
  return mergeMods(run.relics.map((id) => data.relics.get(id)?.mods));
}

export function scriptSlots(run, data) {
  return SCRIPT_SLOTS + (relicMods(run, data).scriptSlots || 0);
}

function gainRelic(run, data, id, notes) {
  const r = data.relics.get(id);
  if (!r || run.relics.includes(id)) return null;
  run.relics.push(id);
  if (r.mods?.maxHp) { run.maxHp += r.mods.maxHp; run.hp += r.mods.maxHp; }
  if (r.onGain?.script) gainScript(run, data, r.onGain.script, notes);
  notes?.push({ kind: 'relic', id, text: `Ferramenta: ${r.name}` });
  return r;
}

function relicPool(run, data, rarities) {
  return [...data.relics.values()].filter((r) => rarities.includes(r.rarity) && !run.relics.includes(r.id));
}

function randomRelic(run, data, rarity) {
  let pool = relicPool(run, data, [rarity]);
  if (!pool.length) pool = relicPool(run, data, ['comum', 'rara']);
  return pool.length ? pick(run, pool).id : null;
}

function gainScript(run, data, id, notes) {
  if (run.scripts.length >= scriptSlots(run, data)) { notes?.push({ kind: 'info', text: 'Sem espaço para mais scripts.' }); return null; }
  const sid = id === 'random' ? pick(run, [...data.scripts.keys()]) : id;
  if (!data.scripts.has(sid)) return null;
  run.scripts.push(sid);
  notes?.push({ kind: 'script', id: sid, text: `Script: ${data.scripts.get(sid).name}` });
  return sid;
}

function gainCredits(run, data, n, notes) {
  const mul = n > 0 ? 1 + (relicMods(run, data).creditMul || 0) : 1;
  const v = Math.round(n * mul);
  run.credits = Math.max(0, run.credits + v);
  if (v) notes?.push({ kind: 'credits', amount: v, text: `${v > 0 ? '+' : ''}${v} créditos` });
  return v;
}

function changeHp(run, n, notes) {
  const before = run.hp;
  run.hp = Math.max(0, Math.min(run.maxHp, run.hp + n));
  const d = run.hp - before;
  if (d) notes?.push({ kind: 'hp', amount: d, text: `${d > 0 ? '+' : ''}${d} de integridade` });
  return d;
}

function checkDeath(run, data, notes) {
  if (run.hp > 0) return false;
  const m = relicMods(run, data);
  if (m.phoenix && !run.phoenixUsed) {
    run.phoenixUsed = true;
    run.hp = Math.min(run.maxHp, m.phoenix);
    notes?.push({ kind: 'relic', text: `Backup em fita: você voltou com ${run.hp} de integridade.` });
    return false;
  }
  run.status = 'dead';
  run.endedAt = Date.now();
  run.deathBy ||= 'um imprevisto';
  return true;
}

// ---------- entrar num nó ----------

export function enterNode(run, nodeId, data) {
  const hop = hopTargets(run).includes(nodeId);
  if (!reachable(run).includes(nodeId) && !hop) return null;
  if (hop) run.hops--;
  const node = run.map.nodes[nodeId];
  run.pos = nodeId;
  run.path.push(nodeId);
  run.floor++;
  const t = node.type;
  if (t === 'combat' || t === 'elite' || t === 'boss') {
    run.pending = { type: 'battle', kind: t, nodeId, enc: buildEncounter(run, t, data), attempt: 0 };
    run.status = 'battle';
  } else if (t === 'event') {
    const pool = data.events.filter((e) => (e.acts || [1, 2, 3]).includes(run.act) && !run.seenEvents.includes(e.id));
    const ev = pick(run, pool.length ? pool : data.events);
    run.seenEvents.push(ev.id);
    run.stats.events++;
    run.pending = { type: 'event', nodeId, eventId: ev.id, result: null };
    run.status = 'event';
  } else if (t === 'rest') {
    run.pending = { type: 'rest', nodeId, done: false, result: null };
    run.status = 'rest';
  } else if (t === 'shop') {
    run.pending = { type: 'shop', nodeId, stock: buildShop(run, data), bought: [] };
    run.status = 'shop';
  } else if (t === 'treasure') {
    const notes = [];
    const rarity = rand(run) < 0.25 ? 'rara' : 'comum';
    const rid = randomRelic(run, data, rarity);
    if (rid) gainRelic(run, data, rid, notes);
    gainCredits(run, data, between(run, 10, 25), notes);
    run.pending = { type: 'treasure', nodeId, notes };
    run.status = 'treasure';
  }
  return run.pending;
}

const threatDmg = (run) => ((run.threat || 0) >= 3 ? 1.25 : 1);

function scaleIntents(intents, dmgMul, extraMul = 1) {
  const m = dmgMul * extraMul;
  return intents.map((it) => {
    const o = { ...it };
    if (o.dmg) o.dmg = Math.max(1, Math.round(o.dmg * m));
    if (o.block) o.block = Math.round(o.block * dmgMul);
    if (o.heal) o.heal = Math.round(o.heal * dmgMul);
    if (o.str) o.str = Math.max(1, Math.round(o.str * (1 + (dmgMul - 1) / 2)));
    return o;
  });
}

export function buildEncounter(run, kind, data, monsterId = null) {
  const act = run.act;
  const th = run.threat || 0;
  if (kind === 'boss') {
    const b = data.bosses.find((x) => x.id === run.bosses[act]);
    const apt = th >= 5;
    return {
      id: b.id, name: b.name, alias: b.alias, sprite: b.sprite, topic: b.topic, nodes: b.nodes,
      title: b.title, briefing: b.briefing, defeat: b.defeat, client: b.client,
      kind, act, ai: b.ai || 'cycle',
      hp: Math.round(b.hp * BOSS_HP * (apt ? 1.25 : 1)),
      intents: scaleIntents(b.intents, BOSS_DMG, threatDmg(run)),
      phases: (b.phases || []).map((ph, i) => ({ ...ph, at: apt ? [0.75, 0.45][i] ?? ph.at : ph.at })),
      affixes: [],
    };
  }
  const pool = data.monsters.filter((m) => m.acts.includes(act));
  let options = pool.filter((m) => !run.recent.includes(m.id));
  if (!options.length) options = pool;
  const m = monsterId ? data.monsters.find((x) => x.id === monsterId) : pick(run, options);
  run.recent = [...run.recent, m.id].slice(-3);
  const affixIds = [...data.affixes.keys()];
  let nAff = 0;
  if (kind === 'elite') nAff = (act === 1 ? 1 : act === 2 ? (rand(run) < 0.5 ? 2 : 1) : 2) + (th >= 1 ? 1 : 0);
  else {
    const chance = [null, th >= 4 ? 0.25 : 0, th >= 4 ? 0.45 : 0.25, th >= 4 ? 0.65 : 0.45][act];
    if (rand(run) < chance) nAff = 1;
  }
  const affixes = shuffle(run, affixIds).slice(0, nAff);
  const hpMul = HP_MUL[act] * (kind === 'elite' ? ELITE_HP : 1) * (affixes.includes('numeroso') ? data.affixes.get('numeroso')?.mods?.hpMul || 1.4 : 1);
  return {
    id: m.id, name: m.name, alias: m.alias, sprite: m.sprite, topic: m.topic, nodes: m.nodes,
    flavor: m.flavor, style: m.style,
    kind, act, ai: m.ai || 'random', opener: m.opener,
    hp: Math.round(m.hp * hpMul),
    intents: scaleIntents(m.intents, DMG_MUL[act], (kind === 'elite' ? ELITE_DMG : 1) * threatDmg(run)),
    phases: [],
    affixes,
  };
}

export function battleCtx(run, data) {
  return {
    cards: data.cards,
    techniques: data.techniques,
    affixes: data.affixes,
    scripts: data.scripts,
    level: data.level,
    branchOf: data.branchOf,
    rusty: new Set(data.rust.list()),
    review: run.review.slice(),
    recent: run.recentCards.slice(),
    caseQuestion: (nodes) => pickQuestion(run, data, nodes),
  };
}

export function battleOptions(run, data) {
  const p = run.pending;
  const mods = relicMods(run, data);
  return {
    attrs: run.attrs,
    seed: hash(`${run.seed}:${p.nodeId}:${p.attempt || 0}`),
    hp: run.hp,
    maxHp: run.maxHp,
    mods,
    phoenix: run.phoenixUsed ? 0 : mods.phoenix || 0,
    scripts: run.scripts,
  };
}

export function startBattle(run, data) {
  return createBattle(run.pending.enc, { ...battleOptions(run, data), ctx: battleCtx(run, data) });
}

// ---------- fim de combate ----------

const XP = { combat: 25, elite: 55, boss: 140 };

export function finishBattle(run, b, data) {
  const p = run.pending;
  const enc = p.enc;
  const kind = p.kind;
  const notes = [];
  run.hp = b.hp;
  if (b.phoenixUsed) run.phoenixUsed = true;
  run.scripts = b.scripts.slice();
  const st = run.stats;
  for (const k of ['cards', 'correct', 'fast', 'crits', 'logs', 'logsOk', 'cases', 'casesOk', 'dmgTaken']) st[k] += b.stats[k];
  st.maxFocus = Math.max(st.maxFocus, b.stats.maxFocus);
  const topic = enc.topic || 'geral';
  const tp = (st.topics[topic] ||= { ok: 0, total: 0, nodes: enc.nodes || [] });
  for (const a of b.answers) {
    tp.total++;
    if (a.ok) {
      tp.ok++;
      const br = data.branchOf?.(a.node);
      if (br) run.areaXp[br] = (run.areaXp[br] || 0) + (a.kind === 'case' ? CASE_XP : CARD_XP);
    } else {
      st.misses[a.id] = (st.misses[a.id] || 0) + 1;
    }
  }
  run.review = [...run.review.filter((id) => !b.reviewClear.has(id)), ...[...b.reviewAdd].filter((id) => !run.review.includes(id))].slice(-REVIEW_MAX);
  run.recentCards = [...run.recentCards, ...b.answers.filter((a) => a.kind === 'flash').map((a) => a.id)].slice(-40);
  const result = { kind, won: b.status === 'won', reason: b.loseReason, notes, rewards: null, rustAdded: [...b.rustAdded], rustCleared: [...b.rustCleared] };
  const actMul = 1 + 0.25 * (run.act - 1);

  if (b.status === 'won') {
    if (kind === 'combat') st.fights++;
    if (kind === 'elite') st.elites++;
    if (kind === 'boss') st.bosses++;
    run.xp += Math.round(XP[kind] * actMul);
    const heal = (run.attrs.recovery || 0) + (relicMods(run, data).healAfter || 0);
    if (heal) changeHp(run, heal, notes);
    result.rewards = buildRewards(run, kind, data);
    run.pending = { type: 'reward', kind, nodeId: p.nodeId, rewards: result.rewards, result };
    run.status = 'reward';
  } else {
    run.hp = 0;
    run.pending = { type: 'over', result };
    run.status = 'dead';
    run.endedAt = Date.now();
    run.deathBy = enc.name;
  }
  return result;
}

function buildRewards(run, kind, data) {
  const act = run.act;
  const items = [];
  let credits = 0;
  let relicChoice = [];
  if (kind === 'combat') {
    credits = between(run, 14, 22) + 4 * (act - 1);
    if (rand(run) < 0.35) items.push({ type: 'script', id: pick(run, [...data.scripts.keys()]) });
  } else if (kind === 'elite') {
    credits = between(run, 28, 38) + 6 * (act - 1);
    const rid = randomRelic(run, data, rand(run) < 0.3 ? 'rara' : 'comum');
    if (rid) items.push({ type: 'relic', id: rid });
    if (rand(run) < 0.45) items.push({ type: 'script', id: pick(run, [...data.scripts.keys()]) });
  } else if (kind === 'boss') {
    credits = 60 + 20 * (act - 1);
    const pool = shuffle(run, relicPool(run, data, ['chefe']));
    const rare = shuffle(run, relicPool(run, data, ['rara']));
    relicChoice = [...pool.slice(0, 2), ...rare.slice(0, 1)].map((r) => r.id);
    if (relicChoice.length < 3) relicChoice = [...relicChoice, ...shuffle(run, relicPool(run, data, ['comum'])).slice(0, 3 - relicChoice.length).map((r) => r.id)];
  }
  return { credits, items, relicChoice, claimed: [] };
}

// Recebe as recompensas. `choice` é o id da ferramenta escolhida (chefe) ou null.
export function claimRewards(run, data, { take = [], relicChoice = null } = {}) {
  const p = run.pending;
  if (!p || p.type !== 'reward') return null;
  const notes = [];
  const rw = p.rewards;
  if (rw.credits) gainCredits(run, data, rw.credits, notes);
  for (const it of rw.items) {
    if (!take.includes(it.id) && it.type === 'script') continue;
    if (it.type === 'relic') gainRelic(run, data, it.id, notes);
    if (it.type === 'script') gainScript(run, data, it.id, notes);
  }
  if (relicChoice && rw.relicChoice.includes(relicChoice)) gainRelic(run, data, relicChoice, notes);
  if (p.kind === 'boss') {
    if (run.act >= ACTS) {
      run.status = 'won';
      run.endedAt = Date.now();
      run.xp += 250;
      run.pending = { type: 'over', notes };
      return notes;
    }
    // próximo ato: recupera parte da integridade perdida e gera o mapa novo
    const healed = Math.round((run.maxHp - run.hp) * 0.5);
    changeHp(run, healed, notes);
    run.act++;
    run.hops = run.attrs?.hops || 0;
    run.map = generateMap(run, run.act);
    run.pos = null;
    run.path = [];
    run.recent = [];
    run.pending = { type: 'act', act: run.act, notes };
    run.status = 'act';
    return notes;
  }
  run.pending = null;
  run.status = 'map';
  return notes;
}

export function continueToMap(run) {
  if (['act', 'treasure'].includes(run.status) || (run.status === 'event' && run.pending?.result) || (run.status === 'rest' && run.pending?.done) || run.status === 'shop') {
    run.pending = null;
    run.status = 'map';
  }
}

// ---------- mercado ----------

function buildShop(run, data) {
  const act = run.act;
  const relics = [
    ...shuffle(run, relicPool(run, data, ['comum'])).slice(0, 2),
    ...shuffle(run, relicPool(run, data, ['rara'])).slice(0, 1),
  ].map((r) => ({ type: 'relic', id: r.id, price: (r.rarity === 'rara' ? between(run, 115, 135) : between(run, 65, 85)) + 8 * (act - 1) }));
  const scripts = shuffle(run, [...data.scripts.values()]).slice(0, 3)
    .map((s) => ({ type: 'script', id: s.id, price: s.price + 3 * (act - 1) }));
  const services = [
    { type: 'heal', id: 'svc-heal', amount: 25, price: 35 + 5 * (act - 1) },
    { type: 'unrust', id: 'svc-unrust', price: 30 },
  ];
  return [...relics, ...scripts, ...services];
}

export function buy(run, data, itemId) {
  const p = run.pending;
  if (!p || p.type !== 'shop') return { ok: false, reason: 'fora do mercado' };
  const it = p.stock.find((x) => x.id === itemId);
  if (!it || p.bought.includes(itemId)) return { ok: false, reason: 'indisponível' };
  if (run.credits < it.price) return { ok: false, reason: 'créditos insuficientes' };
  if (it.type === 'script' && run.scripts.length >= scriptSlots(run, data)) return { ok: false, reason: 'sem espaço para scripts' };
  if (it.type === 'heal' && run.hp >= run.maxHp) return { ok: false, reason: 'integridade já está cheia' };
  if (it.type === 'unrust' && !data.rust.list().length) return { ok: false, reason: 'nenhum nó enferrujado' };
  const notes = [];
  run.credits -= it.price;
  if (it.type === 'relic') gainRelic(run, data, it.id, notes);
  if (it.type === 'script') gainScript(run, data, it.id, notes);
  if (it.type === 'heal') changeHp(run, it.amount, notes);
  if (it.type === 'unrust') { const n = data.rust.list()[0]; data.rust.clear(n); notes.push({ kind: 'unrust', text: 'Um nó deixou de estar enferrujado.' }); }
  if (it.type !== 'heal') p.bought.push(itemId);
  return { ok: true, notes };
}

// ---------- plantão ----------

export function restSleep(run) {
  const p = run.pending;
  if (!p || p.type !== 'rest' || p.done) return null;
  const notes = [];
  changeHp(run, Math.round(run.maxHp * 0.28), notes);
  p.done = true;
  p.result = { kind: 'sleep', notes };
  return notes;
}

// Estudo: uma questão real do banco de provas. Acertar rende integridade máxima e limpa ferrugem.
export function restStudy(run, data, ok, question) {
  const p = run.pending;
  if (!p || p.type !== 'rest' || p.done) return null;
  const notes = [];
  if (ok) {
    run.maxHp += 6;
    changeHp(run, 10, notes);
    notes.push({ kind: 'hp', text: '+6 de integridade máxima' });
    const rusty = data.rust.list();
    const target = rusty.includes(question?.node) ? question.node : rusty[0];
    if (target) { data.rust.clear(target); notes.push({ kind: 'unrust', text: 'Um nó deixou de estar enferrujado.' }); }
  } else {
    notes.push({ kind: 'info', text: 'Não foi dessa vez, mas a explicação fica.' });
  }
  p.done = true;
  p.result = { kind: 'study', ok, notes };
  return notes;
}

// ---------- questões (estudo e imprevistos) ----------

export function pickQuestion(run, data, nodes = []) {
  let pool = [];
  for (const n of nodes) for (const lv of [1, 2]) for (const q of data.questions(n, lv)) pool.push(q);
  if (!pool.length) for (const n of data.questionNodes()) for (const lv of [1, 2]) for (const q of data.questions(n, lv)) pool.push(q);
  if (!pool.length) return null;
  const fresh = pool.filter((q) => !run.asked.includes(q.id));
  const q = pick(run, fresh.length ? fresh : pool);
  run.asked = [...run.asked, q.id].slice(-60);
  // embaralha as alternativas guardando onde ficou a correta
  const order = shuffle(run, q.options.map((_, i) => i));
  return { id: q.id, node: q.node, level: q.level, prompt: q.prompt, context: q.context || null, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer), explain: q.explain };
}

// ---------- imprevistos ----------

export function requirementMet(run, data, req) {
  if (!req) return { ok: true };
  if (req.node) {
    const lv = data.level(req.node);
    return lv >= (req.level || 1) ? { ok: true } : { ok: false, reason: `requer ${data.nodeName(req.node)}` };
  }
  if (req.credits) return run.credits >= req.credits ? { ok: true } : { ok: false, reason: `requer ${req.credits} créditos` };
  return { ok: true };
}

// Escolhe uma opção do imprevisto. Se for de quiz, devolve a questão para a interface perguntar.
export function chooseEvent(run, data, idx) {
  const p = run.pending;
  if (!p || p.type !== 'event' || p.result) return null;
  const ev = data.events.find((e) => e.id === p.eventId);
  const c = ev.choices[idx];
  if (!c || !requirementMet(run, data, c.requires).ok) return null;
  if (c.quiz) {
    const q = pickQuestion(run, data, c.quiz.nodes);
    if (!q) return applyOutcome(run, data, c.quiz.win, idx);
    p.quiz = { idx, question: q };
    return { quiz: q };
  }
  let x = rand(run);
  let out = c.outcomes[c.outcomes.length - 1];
  for (const o of c.outcomes) { x -= o.chance; if (x <= 0) { out = o; break; } }
  return applyOutcome(run, data, out, idx);
}

export function answerEventQuiz(run, data, ok) {
  const p = run.pending;
  if (!p?.quiz) return null;
  const ev = data.events.find((e) => e.id === p.eventId);
  const c = ev.choices[p.quiz.idx];
  const q = p.quiz.question;
  const res = applyOutcome(run, data, ok ? c.quiz.win : c.quiz.lose, p.quiz.idx, { ok, question: q });
  if (!ok && q?.node && data.level(q.node) >= 1) { data.rust.add(q.node); res.notes.push({ kind: 'rust', text: `${data.nodeName(q.node)} enferrujou.` }); }
  if (ok && q?.node && data.rust.list().includes(q.node)) { data.rust.clear(q.node); res.notes.push({ kind: 'unrust', text: `${data.nodeName(q.node)} deixou de estar enferrujado.` }); }
  return res;
}

function applyOutcome(run, data, out, idx, quiz = null) {
  const p = run.pending;
  const notes = [];
  const e = out.effects || {};
  if (e.credits) gainCredits(run, data, e.credits, notes);
  if (e.maxHp) { run.maxHp += e.maxHp; notes.push({ kind: 'hp', text: `+${e.maxHp} de integridade máxima` }); }
  if (e.hp) changeHp(run, e.hp, notes);
  if (e.script) gainScript(run, data, e.script, notes);
  if (e.relic) { const rid = data.relics.has(e.relic) ? e.relic : randomRelic(run, data, e.relic); if (rid) gainRelic(run, data, rid, notes); }
  if (e.unrust) {
    const list = data.rust.list();
    if (list.length) { for (const n of e.unrust === 'all' ? list : list.slice(0, 1)) data.rust.clear(n); notes.push({ kind: 'unrust', text: e.unrust === 'all' ? 'Todos os nós deixaram de estar enferrujados.' : 'Um nó deixou de estar enferrujado.' }); }
  }
  const result = { idx, text: out.text, notes, quiz, fight: e.fight || null };
  p.result = result;
  p.quiz = null;
  if (checkDeath(run, data, notes)) { result.dead = true; return result; }
  if (e.fight) {
    run.pending = { type: 'battle', kind: e.fight === 'elite' ? 'elite' : 'combat', nodeId: `${p.nodeId}-ev`, enc: buildEncounter(run, e.fight === 'elite' ? 'elite' : 'combat', data), attempt: 0, fromEvent: { eventId: p.eventId, result } };
    run.status = 'battle';
  }
  return result;
}

// ---------- pontuação ----------

export function summary(run) {
  const acc = run.stats.cards ? run.stats.correct / run.stats.cards : 0;
  const topics = Object.entries(run.stats.topics).map(([name, t]) => ({ name, ok: t.ok, total: t.total, acc: t.total ? t.ok / t.total : 0, nodes: t.nodes }))
    .sort((a, b) => a.acc - b.acc || b.total - a.total);
  return { acc, topics, won: run.status === 'won', act: run.act, floor: run.floor };
}
