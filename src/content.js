// Carrega e valida o conteúdo (árvore, provas, missões e incidentes) a partir de content/.

const BASE = 'content/';

export const LEVELS = [
  null,
  { n: 1, name: 'Conhecimento', desc: 'reconhece o conceito' },
  { n: 2, name: 'Aplicação', desc: 'usa o conceito numa situação' },
  { n: 3, name: 'Domínio', desc: 'resolve um caso novo ou encontra a falha' },
];

export const TAG_LABELS = {
  recon: 'reconhecimento', cripto: 'criptografia', rede: 'rede', web: 'web', logs: 'logs',
  ident: 'identidade', dados: 'dados', cloud: 'nuvem', gov: 'governança', host: 'servidores', pipeline: 'pipeline',
};

export const content = {
  version: '0.0.0',
  branches: [],
  nodes: new Map(),
  questions: new Map(), // nodeId -> { 1: [], 2: [], 3: [] }
  missions: [],
  battle: { techniques: new Map() },
  run: { monsters: [], bosses: [], affixes: new Map(), relics: new Map(), scripts: new Map(), events: [], cards: [] },
  upcoming: [],
  warnings: [],
  totalQuestions: 0,
};

async function getJSON(path) {
  const res = await fetch(BASE + path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  try { return await res.json(); }
  catch (err) { throw new Error(`${path}: JSON inválido (${err.message})`); }
}

function warn(msg) { content.warnings.push(msg); console.warn('[green/conteúdo]', msg); }

function indexTree(tree) {
  tree.branches.forEach((branch, bi) => {
    if (!branch.id || !branch.name || !Array.isArray(branch.nodes)) { warn(`ramo ${bi} incompleto`); return; }
    const b = { id: branch.id, name: branch.name, index: bi, nodes: [] };
    for (const node of branch.nodes) {
      const missing = ['id', 'code', 'name', 'short', 'ring', 'summary'].filter((k) => node[k] == null);
      if (missing.length) { warn(`nó ${node.id || '?'} sem: ${missing.join(', ')}`); continue; }
      if (content.nodes.has(node.id)) { warn(`nó duplicado: ${node.id}`); continue; }
      const n = { ...node, requires: node.requires || [], offset: node.offset || 0, branch: b.id, branchIndex: bi, branchName: b.name };
      content.nodes.set(n.id, n);
      content.questions.set(n.id, { 1: [], 2: [], 3: [] });
      b.nodes.push(n);
    }
    content.branches.push(b);
  });
  for (const n of content.nodes.values()) {
    for (const r of n.requires) if (!content.nodes.has(r)) warn(`nó ${n.id} exige ${r}, que não existe`);
  }
}

function indexExam(file, data) {
  const seen = new Set();
  for (const q of data.questions || []) {
    const where = `${file} › ${q.id || '?'}`;
    if (!q.id || seen.has(q.id)) { warn(`${where}: id ausente ou duplicado`); continue; }
    seen.add(q.id);
    if (!content.nodes.has(q.node)) { warn(`${where}: nó ${q.node} não existe`); continue; }
    if (![1, 2, 3].includes(q.level)) { warn(`${where}: nível inválido`); continue; }
    if (!Array.isArray(q.options) || q.options.length < 2) { warn(`${where}: precisa de 2+ alternativas`); continue; }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) { warn(`${where}: gabarito inválido`); continue; }
    if (!q.prompt || !q.explain) { warn(`${where}: falta enunciado ou explicação`); continue; }
    content.questions.get(q.node)[q.level].push(q);
    content.totalQuestions++;
  }
}

function indexMission(file, m) {
  if (!m.id || !m.title || !Array.isArray(m.steps) || !m.steps.length) { warn(`${file}: missão incompleta`); return; }
  for (const step of m.steps) {
    for (const opt of step.options || []) {
      if (opt.requires && !content.nodes.has(opt.requires.node)) warn(`${file} › ${opt.id}: requer nó inexistente ${opt.requires.node}`);
      if (!['good', 'ok', 'bad'].includes(opt.outcome)) warn(`${file} › ${opt.id}: outcome inválido`);
    }
  }
  content.missions.push(m);
}

export function indexTechniques(file, data) {
  const B = content.battle;
  for (const t of data.techniques || []) {
    const where = `${file} › ${t.id || '?'}`;
    if (!t.id || B.techniques.has(t.id)) { warn(`${where}: id ausente ou duplicado`); continue; }
    const missing = ['name', 'attack', 'tactic', 'evidence', 'explain'].filter((k) => t[k] == null);
    if (missing.length) { warn(`${where}: falta ${missing.join(', ')}`); continue; }
    if (t.node && !content.nodes.has(t.node)) warn(`${where}: nó ${t.node} não existe`);
    B.techniques.set(t.id, t);
  }
}

function checkTechniques() {
  const B = content.battle;
  for (const t of B.techniques.values()) {
    for (const c of t.confusers || []) if (!B.techniques.has(c)) warn(`${t.id}: confusor ${c} não existe`);
    if ((t.confusers || []).length < 2) warn(`${t.id}: a análise de log precisa de pelo menos 2 confusores`);
  }
}

const INTENT_KEYS = new Set(['type', 'tech', 'name', 'dmg', 'hits', 'block', 'str', 'heal', 'status', 'turns', 'w']);

function checkEnemy(where, e) {
  const B = content.battle;
  if (!e.id || !e.name || !e.hp || !Array.isArray(e.intents) || !e.intents.length) { warn(`${where}: incompleto (precisa de id, name, hp e intents)`); return false; }
  for (const it of e.intents) {
    if (it.tech && !B.techniques.has(it.tech)) warn(`${where}: técnica ${it.tech} não existe`);
    if (!it.tech && !it.name) warn(`${where}: intenção sem técnica nem nome`);
    const bad = Object.keys(it).filter((k) => !INTENT_KEYS.has(k));
    if (bad.length) warn(`${where}: campo de intenção desconhecido ${bad.join(', ')}`);
  }
  for (const id of e.nodes || []) if (!content.nodes.has(id)) warn(`${where}: nó ${id} não existe`);
  return true;
}

function indexCards(data) {
  const seen = new Set();
  for (const c of data.cards || []) {
    if (!c.id || seen.has(c.id)) { warn(`flashcard ${c.id || '?'}: id ausente ou duplicado`); continue; }
    if (!content.nodes.has(c.node)) { warn(`flashcard ${c.id}: nó ${c.node} não existe`); continue; }
    if (!c.q || !Array.isArray(c.a) || c.a.length < 2) { warn(`flashcard ${c.id}: precisa de pergunta e 2+ alternativas`); continue; }
    seen.add(c.id);
    content.run.cards.push(c);
  }
  for (const n of content.nodes.values()) if (!content.run.cards.some((c) => c.node === n.id)) warn(`nó ${n.id} sem flashcards`);
}

export function branchOf(nodeId) {
  return content.nodes.get(nodeId)?.branch || null;
}

function indexRun(mon, bos, aff, items, evs, cards) {
  const R = content.run;
  for (const m of mon.monsters || []) if (checkEnemy(`monstro ${m.id}`, m)) R.monsters.push(m);
  for (const b of bos.bosses || []) if (checkEnemy(`chefe ${b.id}`, b)) R.bosses.push(b);
  indexCards(cards);
  for (const a of aff.affixes || []) R.affixes.set(a.id, a);
  for (const r of items.relics || []) R.relics.set(r.id, r);
  for (const s of items.scripts || []) R.scripts.set(s.id, s);
  for (const ev of evs.events || []) {
    for (const c of ev.choices || []) {
      if (c.requires?.node && !content.nodes.has(c.requires.node)) warn(`evento ${ev.id}: requer nó inexistente ${c.requires.node}`);
      for (const n of c.quiz?.nodes || []) if (!content.nodes.has(n)) warn(`evento ${ev.id}: quiz com nó inexistente ${n}`);
    }
    R.events.push(ev);
  }
  for (const act of [1, 2, 3]) {
    if (!R.bosses.some((b) => b.act === act)) warn(`nenhum chefe para o ato ${act}`);
    if (!R.monsters.some((m) => m.acts.includes(act))) warn(`nenhum monstro para o ato ${act}`);
  }
}

export async function loadContent(onStep = () => {}) {
  const manifest = await getJSON('manifest.json');
  content.version = manifest.version || '0.0.0';
  content.upcoming = manifest.upcoming || [];
  onStep('manifesto', manifest.version);

  const tree = await getJSON(manifest.tree);
  indexTree(tree);
  onStep('árvore', `${content.nodes.size} nós em ${content.branches.length} ramos`);

  const exams = await Promise.all((manifest.exams || []).map(async (f) => [f, await getJSON(f)]));
  for (const [f, data] of exams) indexExam(f, data);
  onStep('provas', `${content.totalQuestions} questões`);

  const missions = await Promise.all((manifest.missions || []).map(async (f) => [f, await getJSON(f)]));
  for (const [f, data] of missions) indexMission(f, data);
  onStep('missões', `${content.missions.length} contrato(s)`);

  if (manifest.battle) {
    const techFiles = [].concat(manifest.battle.techniques || []);
    const techs = await Promise.all(techFiles.map(getJSON));
    techs.forEach((t, i) => indexTechniques(techFiles[i], t));
    checkTechniques();
  }

  if (manifest.run) {
    const rn = manifest.run;
    const [mon, bos, aff, items, evs, cards] = await Promise.all([rn.monsters, rn.bosses, rn.affixes, rn.items, rn.events, rn.flashcards].map(getJSON));
    indexRun(mon, bos, aff, items, evs, cards);
    onStep('operação', `${content.run.monsters.length} monstros · ${content.run.bosses.length} chefes · ${content.run.cards.length} flashcards · ${content.battle.techniques.size} técnicas`);
  }

  return content;
}
