// oi
// Combate v0.4: cartas de conhecimento.
//
// Regra de ouro: responder certo É a ação. Cada turno você tem banda (pontos de ação) e escolhe:
//   Atacar (1)      abre um flashcard. Acertou: dano. Acertou rápido: crítico.
//   Defender (1)    abre um flashcard. Acertou: bloqueio contra o próximo golpe. Rápido: +50%.
//   Analisar log (2) mostra o log da técnica que o inimigo anunciou. Identificou: o golpe é anulado,
//                   você contra-ataca e o inimigo fica exposto (+50% de dano) até o fim do turno.
// O inimigo mostra a intenção do próximo turno (atacar, bloquear, se fortalecer, sabotar).
// Chefes interrompem a luta com questões de caso em 66% e 33% da vida.
//
// Puro e determinístico: sem DOM, sem relógio. A interface mede o tempo de resposta e passa em ms.
// O simulador (tools/sim-run.mjs) usa as mesmas funções.

export const CARD_TIME = { flash: 12, log: 25, case: 60 };
export const FAST = 0.5;            // fração do cronômetro: respondeu antes disso, foi rápido
export const FOCUS_MAX = 5;
export const FOCUS_STEP = 0.1;      // +10% de dano e bloqueio por ponto de foco
export const EXPOSE_MUL = 1.5;
export const VULN_MUL = 1.25;
export const CASE_DMG = 12;
export const RAGE = 0.3;
export const NOISE = 4;             // segundos a menos com ruído
export const BLEED = 3;

export const ACTIONS = {
  attack: { id: 'attack', name: 'Atacar', cost: 1, icon: 'sword', card: 'flash', key: '1', text: 'Flashcard. Acertou: dano. Rápido: crítico.' },
  defend: { id: 'defend', name: 'Defender', cost: 1, icon: 'shield', card: 'flash', key: '2', text: 'Flashcard. Acertou: bloqueio até o fim do turno do inimigo. Rápido: +50%.' },
  analyze: { id: 'analyze', name: 'Analisar log', cost: 2, icon: 'eye', card: 'log', key: '3', text: 'Log da técnica anunciada. Identificou: anula o golpe, contra-ataca e expõe o inimigo.' },
};

export const STATUS = {
  credencial: { side: 'you', name: 'Credencial roubada', icon: 'key', desc: '−1 de banda no próximo turno.' },
  ruido: { side: 'you', name: 'Ruído', icon: 'blind', desc: `Cartas com ${NOISE} s a menos neste turno.` },
  vazamento: { side: 'you', name: 'Vazamento', icon: 'drop', desc: `Perde ${BLEED} de integridade no início de cada turno.` },
  vulneravel: { side: 'you', name: 'Sem cobertura', icon: 'target', desc: 'Recebe 25% a mais de dano.' },
  exposto: { side: 'foe', name: 'Exposto', icon: 'target', desc: 'Recebe 50% a mais de dano.' },
  atordoado: { side: 'foe', name: 'Atordoado', icon: 'chain', desc: 'Perde a próxima ação.' },
};

export const INTENT_TYPES = {
  attack: { name: 'Ataque', icon: 'sword' },
  block: { name: 'Defesa', icon: 'shield' },
  buff: { name: 'Fortalecer', icon: 'bolt' },
  debuff: { name: 'Sabotagem', icon: 'hook' },
  heal: { name: 'Recuperar', icon: 'heart' },
};

// ---------- utilidades ----------

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function next(b) {
  let a = b.rng >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  b.rng = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(b, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next(b) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function redact(text, pct, seed = 1) {
  if (!pct) return text;
  const p = Math.min(0.85, pct / 100);
  let i = 0;
  return text.replace(/\S+/g, (tok) => {
    i++;
    if (tok === '...' || tok === '·' || tok === '→' || tok.length < 3) return tok;
    const roll = (hash(`${seed}:${i}:${tok.length}`) % 1000) / 1000;
    if (roll >= p) return tok;
    const eq = tok.indexOf('=');
    if (eq > 0 && eq < tok.length - 1) return tok.slice(0, eq + 1) + '█'.repeat(Math.min(14, tok.length - eq - 1));
    return '█'.repeat(Math.min(16, tok.length));
  });
}

export function mergeMods(list) {
  const out = {};
  for (const m of list) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === 'number') out[k] = (out[k] || 0) + v;
      else if (Array.isArray(v)) out[k] = [...(out[k] || []), ...v];
      else if (typeof v === 'boolean') out[k] = out[k] || v;
      else out[k] = v;
    }
  }
  return out;
}

// ---------- criação ----------

// enc: { id, name, kind, hp, intents[], ai, nodes[], affixes[], phases[] } (valores já escalados pela operação)
// ctx: { cards[], techniques Map, affixes Map, scripts Map, level(id), rusty Set, review[], recent[], caseQuestion(nodes) }
export function createBattle(enc, { attrs, mods = {}, hp, maxHp, scripts = [], seed = 1, ctx, phoenix = 0 }) {
  const affix = mergeMods((enc.affixes || []).map((id) => ctx.affixes?.get(id)?.mods));
  const b = {
    enc, ctx, attrs, mods, affix,
    rng: (seed ^ 0x5bd1e995) >>> 0,
    status: 'running', loseReason: null,
    turn: 0,
    hp, maxHp, block: 0, ap: 0, maxAp: attrs.ap + (mods.apBonus || 0), carry: 0,
    focus: 0,
    you: { credencial: 0, ruido: 0, vazamento: 0, vulneravel: 0 },
    foe: { hp: enc.hp, maxHp: enc.hp, block: 0, str: 0, rage: 0, exposto: mods.startExposed || 0, atordoado: 0 },
    intent: null, intentLog: [], cycle: 0,
    card: null, analyzed: false,
    scripts: scripts.slice(),
    cardCut: 0,
    wrongFree: mods.firstWrongFree || 0,
    autoNegate: mods.autoNegate || 0,
    phoenix, phoenixUsed: false,
    phases: (enc.phases || []).map((p) => ({ ...p, hit: false })),
    pendingCase: null,
    deck: [], deckPos: 0, seen: new Set(),
    answers: [],
    rustAdded: new Set(), rustCleared: new Set(), reviewAdd: new Set(), reviewClear: new Set(),
    stats: { cards: 0, correct: 0, fast: 0, crits: 0, dmgDealt: 0, dmgTaken: 0, blocked: 0, negated: 0, logs: 0, logsOk: 0, cases: 0, casesOk: 0, maxFocus: 0, byNode: {} },
  };
  buildDeck(b);
  pickIntent(b);
  startTurn(b, []);
  return b;
}

function buildDeck(b) {
  const { ctx, enc } = b;
  const nodes = new Set(enc.nodes || []);
  let pool = ctx.cards.filter((c) => nodes.has(c.node));
  if (pool.length < 10) {
    const branches = new Set([...nodes].map((n) => ctx.branchOf?.(n)).filter(Boolean));
    pool = [...pool, ...ctx.cards.filter((c) => !nodes.has(c.node) && branches.has(ctx.branchOf?.(c.node)))];
  }
  if (!pool.length) pool = ctx.cards.slice();
  const recent = new Set(ctx.recent || []);
  const fresh = shuffle(b, pool.filter((c) => !recent.has(c.id)));
  const old = shuffle(b, pool.filter((c) => recent.has(c.id)));
  b.deck = [...fresh, ...old].map((c) => c.id);
  b.deckPos = 0;
}

function drawFlash(b) {
  const { ctx } = b;
  const byId = (id) => ctx.cards.find((c) => c.id === id);
  // cartas erradas antes nesta operação voltam de vez em quando
  const review = (ctx.review || []).filter((id) => !b.seen.has(id));
  if (review.length && next(b) < 0.3) {
    const c = byId(review[Math.floor(next(b) * review.length)]);
    if (c) return { card: c, review: true };
  }
  if (b.deckPos >= b.deck.length) { b.deck = shuffle(b, b.deck); b.deckPos = 0; }
  const c = byId(b.deck[b.deckPos++]);
  return { card: c, review: false };
}

// ---------- intenção do inimigo ----------

function pickIntent(b) {
  const list = b.enc.intents;
  let i;
  if (b.enc.ai === 'cycle') {
    i = b.cycle % list.length;
    b.cycle++;
  } else {
    const last2 = b.intentLog.slice(-2);
    const banned = last2.length === 2 && last2[0] === last2[1] ? last2[0] : -1;
    const opts = list.map((it, k) => [k, k === banned ? 0 : it.w ?? 1]).filter(([, w]) => w > 0);
    if (b.turn === 0 && b.enc.opener != null) i = b.enc.opener;
    else {
      const total = opts.reduce((s, [, w]) => s + w, 0);
      let x = next(b) * total;
      i = opts[opts.length - 1][0];
      for (const [k, w] of opts) { x -= w; if (x <= 0) { i = k; break; } }
    }
  }
  b.intentLog.push(i);
  b.intent = { ...list[i], idx: i, negated: false };
}

export function hitDamage(b, it = b.intent) {
  if (!it?.dmg) return 0;
  const mul = (1 + b.foe.rage) * (b.affix.dmgMul || 1) * (b.you.vulneravel ? VULN_MUL : 1);
  return Math.max(0, Math.round((it.dmg + b.foe.str) * mul) - (b.mods.dmgReduce || 0));
}

// O que a interface mostra sobre a próxima ação do inimigo.
export function intentView(b) {
  const it = b.intent;
  if (!it) return null;
  const tech = it.tech ? b.ctx.techniques.get(it.tech) : null;
  return {
    type: it.type, name: it.name || tech?.name || INTENT_TYPES[it.type]?.name,
    tech, dmg: hitDamage(b, it), hits: it.hits || 1, block: it.block || 0, str: it.str || 0, heal: it.heal || 0,
    status: it.status || null, turns: it.turns || 0,
    hidden: !!b.affix.hideIntent, negated: it.negated, stunned: b.foe.atordoado > 0,
    analyzable: !!tech && !it.negated && b.foe.atordoado <= 0,
  };
}

// ---------- turno do jogador ----------

function startTurn(b, ev) {
  b.turn++;
  b.analyzed = false;
  const first = b.turn === 1;
  const kept = b.mods.blockCarry ? Math.floor(b.block * Math.min(1, b.mods.blockCarry)) : 0;
  b.block = kept;
  let ap = b.maxAp + b.carry + (first ? b.mods.firstTurnAp || 0 : 0);
  b.carry = 0;
  if (b.you.credencial > 0) { ap = Math.max(1, ap - 1); b.you.credencial--; ev.push({ type: 'statusTick', status: 'credencial' }); }
  b.ap = ap;
  const armor = (b.attrs.armor || 0) + (first ? b.mods.firstTurnBlock || 0 : 0);
  if (armor) { b.block += armor; ev.push({ type: 'armor', amount: armor }); }
  if (b.you.vazamento > 0) {
    b.you.vazamento--;
    loseHp(b, BLEED, ev, 'vazamento');
  }
  ev.push({ type: 'turn', turn: b.turn });
}

export function actionCost(b, id) {
  if (id === 'analyze') return Math.max(1, ACTIONS.analyze.cost - (b.mods.analyzeDiscount || 0));
  return ACTIONS[id].cost;
}

export function canAct(b, id) {
  if (b.status !== 'running') return { ok: false, reason: 'combate encerrado' };
  if (b.card) return { ok: false, reason: 'responda a carta aberta' };
  if (b.pendingCase) return { ok: false, reason: 'questão de caso pendente' };
  const cost = actionCost(b, id);
  if (b.ap < cost) return { ok: false, reason: 'banda insuficiente', cost };
  if (id === 'analyze') {
    const iv = intentView(b);
    if (b.analyzed) return { ok: false, reason: 'uma análise por turno', cost };
    if (!iv?.tech) return { ok: false, reason: 'nada para analisar: o inimigo não vai usar uma técnica', cost };
    if (iv.negated) return { ok: false, reason: 'golpe já anulado', cost };
    if (iv.stunned) return { ok: false, reason: 'inimigo atordoado', cost };
  }
  return { ok: true, cost };
}

export function cardTime(b, kind) {
  const base = CARD_TIME[kind] + (b.attrs.timer || 0) * (kind === 'case' ? 2 : 1) + (b.mods.timerBonus || 0);
  const noisy = b.you.ruido > 0 ? NOISE : 0;
  return Math.max(5, Math.round((base - noisy) * (b.affix.timerMul || 1) * 10) / 10);
}

// Abre a carta de uma ação. A banda é gasta aqui: não dá para desistir depois de ver a pergunta.
export function openCard(b, id) {
  const chk = canAct(b, id);
  if (!chk.ok) return null;
  b.ap -= chk.cost;
  if (id === 'analyze') b.analyzed = true;
  const card = id === 'analyze' ? logCard(b) : flashCard(b);
  card.action = id;
  card.cost = chk.cost;
  b.card = card;
  return card;
}

// Questão de caso do chefe (sem custo, obrigatória quando uma fase é atingida).
export function openCase(b) {
  if (!b.pendingCase || b.card) return null;
  const q = b.ctx.caseQuestion?.(b.enc.nodes || []);
  if (!q) { b.pendingCase = null; return null; }
  b.card = {
    kind: 'case', action: 'case', id: q.id, node: q.node, level: q.level,
    q: q.prompt, context: q.context || null, options: q.options, answer: q.answer, why: q.explain,
    time: cardTime(b, 'case'), cut: [], phase: b.pendingCase,
  };
  return b.card;
}

function applyCut(b, card, n) {
  const wrong = card.options.map((_, i) => i).filter((i) => i !== card.answer && !card.cut.includes(i));
  for (const i of shuffle(b, wrong).slice(0, n)) card.cut.push(i);
}

function flashCard(b) {
  const { card: c, review } = drawFlash(b);
  b.seen.add(c.id);
  const order = shuffle(b, c.a.map((_, i) => i));
  const card = {
    kind: 'flash', id: c.id, node: c.node, q: c.q, options: order.map((i) => c.a[i]), answer: order.indexOf(0), why: c.why,
    time: cardTime(b, 'flash'), cut: [], review,
  };
  if (b.cardCut) { applyCut(b, card, b.cardCut); b.cardCut = 0; }
  return card;
}

function logCard(b) {
  const tech = b.ctx.techniques.get(b.intent.tech);
  const ids = [tech.id, ...(tech.confusers || []).filter((id) => b.ctx.techniques.has(id)).slice(0, 3)];
  const order = shuffle(b, ids);
  const ev = tech.evidence[Math.floor(next(b) * tech.evidence.length)];
  const card = {
    kind: 'log', id: tech.id, node: tech.node, techId: tech.id,
    q: 'Qual técnica aparece neste log?', source: tech.source,
    evidence: redact(ev, b.affix.redact || 0, hash(`${b.turn}:${tech.id}`)),
    options: order.map((id) => b.ctx.techniques.get(id).name),
    optionIds: order, optionEn: order.map((id) => b.ctx.techniques.get(id).en),
    answer: order.indexOf(tech.id), why: tech.explain, tell: tech.tell, attack: tech.attack,
    time: cardTime(b, 'log'), cut: [],
  };
  const cut = (b.mods.logCut || 0) + b.cardCut;
  b.cardCut = 0;
  if (cut) applyCut(b, card, Math.min(cut, card.options.length - 2));
  return card;
}

// ---------- resposta ----------

// pick: índice escolhido ou -1 (tempo esgotado). ms: tempo que a pessoa levou.
export function answerCard(b, pick, ms = 0) {
  const card = b.card;
  if (!card || b.status !== 'running') return null;
  const ok = pick === card.answer;
  const ev = [];
  if (!ok && pick >= 0 && b.wrongFree > 0 && !card.retried) {
    b.wrongFree--;
    card.retried = true;
    card.cut.push(pick);
    return { retry: true, events: [{ type: 'retry' }] };
  }
  const fast = ok && !card.retried && ms <= card.time * 1000 * FAST;
  b.card = null;
  const focusBefore = b.focus;
  const mulFocus = 1 + FOCUS_STEP * focusBefore;
  record(b, card, pick, ok, fast, ms);

  if (ok) {
    b.focus = Math.min(FOCUS_MAX, b.focus + (card.kind === 'case' ? 2 : 1));
    b.stats.maxFocus = Math.max(b.stats.maxFocus, b.focus);
    if (card.action === 'attack') {
      const crit = fast;
      const critMul = b.attrs.crit + (b.mods.critMulBonus || 0);
      const dmg = Math.round(b.attrs.atk * mulFocus * (1 + (b.mods.atkMul || 0)) * (crit ? critMul : 1));
      if (crit) b.stats.crits++;
      dealDamage(b, dmg, ev, { src: 'attack', crit });
    } else if (card.action === 'defend') {
      const amount = Math.round(b.attrs.def * mulFocus * (fast ? 1.5 : 1)) + (b.mods.defBonus || 0);
      b.block += amount;
      ev.push({ type: 'block', amount, fast });
    } else if (card.action === 'analyze') {
      b.intent.negated = true;
      b.stats.negated++;
      ev.push({ type: 'negate', tech: b.ctx.techniques.get(card.techId) });
      b.foe.exposto = Math.max(b.foe.exposto, 1);
      ev.push({ type: 'expose', turns: 1 });
      if (b.mods.analyzeRefund) { b.ap += b.mods.analyzeRefund; ev.push({ type: 'ap', amount: b.mods.analyzeRefund }); }
      const critMul = b.attrs.crit + (b.mods.critMulBonus || 0);
      const dmg = Math.round(b.attrs.analysis * mulFocus * (fast ? critMul : 1));
      if (fast) b.stats.crits++;
      dealDamage(b, dmg, ev, { src: 'counter', crit: fast });
    } else if (card.action === 'case') {
      b.foe.atordoado = 1;
      ev.push({ type: 'stun' });
      const dmg = Math.round((CASE_DMG + b.attrs.analysis) * mulFocus);
      dealDamage(b, dmg, ev, { src: 'case', crit: true });
    }
    ev.push({ type: 'focus', value: b.focus, up: true });
  } else {
    const lost = b.focus;
    b.focus = 0;
    if (lost) ev.push({ type: 'focus', value: 0, lost });
    if (card.action === 'case') {
      b.foe.rage += RAGE;
      ev.push({ type: 'enrage', rage: b.foe.rage });
    }
  }
  if (card.action === 'case') { b.pendingCase = null; card.phase && (card.phase.done = true); }
  if (b.status === 'running') checkPhases(b, ev);
  return { ok, fast, pick, card, events: [{ type: 'answer', ok, fast, card, pick, timeout: pick < 0 }, ...ev] };
}

function record(b, card, pick, ok, fast, ms) {
  const s = b.stats;
  s.cards++;
  if (ok) s.correct++;
  if (fast) s.fast++;
  if (card.kind === 'log') { s.logs++; if (ok) s.logsOk++; }
  if (card.kind === 'case') { s.cases++; if (ok) s.casesOk++; }
  if (card.node) {
    const bn = (s.byNode[card.node] ||= { ok: 0, total: 0 });
    bn.total++;
    if (ok) bn.ok++;
  }
  b.answers.push({ kind: card.kind, action: card.action, id: card.id, node: card.node, q: card.q, options: card.options, answer: card.answer, pick, ok, fast, why: card.why, ms, techId: card.techId || null, tell: card.tell || null });
  if (card.kind === 'flash') {
    if (ok) { if (card.review) b.reviewClear.add(card.id); }
    else { b.reviewAdd.add(card.id); b.reviewClear.delete(card.id); }
  }
  const n = card.node;
  if (n && b.ctx.level?.(n) >= 1) {
    const rusty = b.ctx.rusty?.has(n) || b.rustAdded.has(n);
    if (ok && rusty) { b.rustAdded.delete(n); b.rustCleared.add(n); }
    else if (!ok && !rusty && card.kind !== 'flash') { b.rustAdded.add(n); b.rustCleared.delete(n); }
  }
}

function dealDamage(b, amount, ev, { src, crit = false } = {}) {
  let dmg = amount;
  if (b.foe.exposto > 0) dmg = Math.round(dmg * EXPOSE_MUL);
  const absorbed = Math.min(b.foe.block, dmg);
  b.foe.block -= absorbed;
  const real = Math.min(b.foe.hp, dmg - absorbed);
  b.foe.hp -= real;
  b.stats.dmgDealt += real;
  ev.push({ type: 'hit', amount: dmg - absorbed, absorbed, crit, src, exposed: b.foe.exposto > 0 });
  if (b.foe.hp <= 0) { b.status = 'won'; ev.push({ type: 'win' }); }
}

function checkPhases(b, ev) {
  if (b.pendingCase) return;
  const frac = b.foe.hp / b.foe.maxHp;
  for (const ph of b.phases) {
    if (ph.hit || frac > ph.at) continue;
    ph.hit = true;
    if (ph.str) b.foe.str += ph.str;
    b.pendingCase = ph;
    ev.push({ type: 'phase', phase: ph });
    break;
  }
}

// ---------- scripts ----------

export function canUseScript(b, i) {
  const s = b.ctx.scripts.get(b.scripts[i]);
  if (!s) return { ok: false, reason: 'vazio' };
  if (b.status !== 'running') return { ok: false, reason: 'combate encerrado' };
  if (b.card || b.pendingCase) return { ok: false, reason: 'responda a carta aberta' };
  const e = s.effects;
  if (e.heal && b.hp >= b.maxHp) return { ok: false, reason: 'integridade cheia' };
  if (e.cleanse && !Object.values(b.you).some((v) => v > 0)) return { ok: false, reason: 'nenhum efeito para remover' };
  return { ok: true };
}

export function useScript(b, i) {
  if (!canUseScript(b, i).ok) return null;
  const s = b.ctx.scripts.get(b.scripts[i]);
  b.scripts.splice(i, 1);
  const e = s.effects;
  const ev = [{ type: 'script', script: s }];
  if (e.flatDamage) dealDamage(b, e.flatDamage, ev, { src: 'script' });
  if (e.heal) heal(b, e.heal, ev);
  if (e.block) { b.block += e.block; ev.push({ type: 'block', amount: e.block }); }
  if (e.ap) { b.ap += e.ap; ev.push({ type: 'ap', amount: e.ap }); }
  if (e.expose) { b.foe.exposto = Math.max(b.foe.exposto, e.expose); ev.push({ type: 'expose', turns: e.expose }); }
  if (e.cardCut) { b.cardCut += e.cardCut; ev.push({ type: 'cut', amount: e.cardCut }); }
  if (e.focus) { b.focus = Math.min(FOCUS_MAX, b.focus + e.focus); ev.push({ type: 'focus', value: b.focus, up: true }); }
  if (e.cleanse) { for (const k of Object.keys(b.you)) b.you[k] = 0; ev.push({ type: 'cleanse' }); }
  if (b.status === 'running') checkPhases(b, ev);
  return ev;
}

function heal(b, n, ev) {
  const before = b.hp;
  b.hp = Math.min(b.maxHp, b.hp + n);
  if (b.hp > before) ev.push({ type: 'heal', amount: b.hp - before });
}

function loseHp(b, n, ev, cause) {
  if (n <= 0) return;
  b.hp = Math.max(0, b.hp - n);
  b.stats.dmgTaken += n;
  ev.push({ type: 'hurt', amount: n, cause });
  if (b.hp <= 0) {
    if (b.phoenix && !b.phoenixUsed) {
      b.phoenixUsed = true;
      b.hp = Math.min(b.maxHp, b.phoenix);
      ev.push({ type: 'phoenix', amount: b.hp });
      return;
    }
    b.status = 'lost';
    b.loseReason = 'integrity';
    ev.push({ type: 'lose' });
  }
}

// ---------- turno do inimigo ----------

export function canEndTurn(b) {
  return b.status === 'running' && !b.card && !b.pendingCase;
}

export function endTurn(b) {
  if (!canEndTurn(b)) return [];
  const ev = [];
  // fim do turno do jogador
  const cap = b.mods.carryMax || 0;
  if (cap && b.ap > 0) { b.carry = Math.min(cap, b.ap); ev.push({ type: 'carry', amount: b.carry }); }
  if (b.foe.exposto > 0) b.foe.exposto--;
  if (b.you.ruido > 0) b.you.ruido--;
  b.ap = 0;

  // turno do inimigo
  b.foe.block = 0;
  if (b.affix.regen && b.foe.hp < b.foe.maxHp) {
    const r = Math.min(b.affix.regen, b.foe.maxHp - b.foe.hp);
    b.foe.hp += r;
    ev.push({ type: 'regen', amount: r });
  }
  if (b.affix.blockPerTurn) { b.foe.block += b.affix.blockPerTurn; ev.push({ type: 'foeBlock', amount: b.affix.blockPerTurn, passive: true }); }

  const it = b.intent;
  const wasVuln = b.you.vulneravel;
  if (b.foe.atordoado > 0) {
    b.foe.atordoado--;
    ev.push({ type: 'skip', reason: 'stun', intent: it });
  } else if (it.negated) {
    ev.push({ type: 'skip', reason: 'negated', intent: it });
  } else if (b.autoNegate && it.type === 'attack') {
    b.autoNegate--;
    b.stats.negated++;
    ev.push({ type: 'skip', reason: 'honeypot', intent: it });
  } else {
    runIntent(b, it, ev);
  }
  if (b.status !== 'running') return ev;
  if (wasVuln > 0) b.you.vulneravel--;

  pickIntent(b);
  ev.push({ type: 'intent', intent: intentView(b) });
  startTurn(b, ev);
  return ev;
}

function runIntent(b, it, ev) {
  const tech = it.tech ? b.ctx.techniques.get(it.tech) : null;
  ev.push({ type: 'enemy', intent: it, tech });
  // uma intenção pode combinar efeitos: dano (com vários golpes), bloqueio, força, cura e um efeito no jogador
  if (it.dmg) {
    const per = hitDamage(b, it);
    for (let h = 0; h < (it.hits || 1); h++) {
      const absorbed = Math.min(b.block, per);
      b.block -= absorbed;
      b.stats.blocked += absorbed;
      const real = per - absorbed;
      ev.push({ type: 'strike', amount: real, absorbed, hit: h, hits: it.hits || 1 });
      if (real) loseHp(b, real, ev, 'attack');
      if (b.status !== 'running') return;
    }
  }
  if (it.block) { b.foe.block += it.block; ev.push({ type: 'foeBlock', amount: it.block }); }
  if (it.str) { b.foe.str += it.str; ev.push({ type: 'foeBuff', str: it.str, total: b.foe.str }); }
  if (it.heal) {
    const r = Math.min(it.heal, b.foe.maxHp - b.foe.hp);
    if (r) { b.foe.hp += r; ev.push({ type: 'foeHeal', amount: r }); }
  }
  if (it.status) {
    if ((b.mods.immune || []).includes(it.status)) ev.push({ type: 'immune', status: it.status });
    else {
      b.you[it.status] = Math.max(b.you[it.status] || 0, it.turns || 1);
      ev.push({ type: 'status', status: it.status, turns: it.turns || 1 });
    }
  }
}

// ---------- resumo ----------

export function accuracy(b) {
  return b.stats.cards ? b.stats.correct / b.stats.cards : 0;
}
