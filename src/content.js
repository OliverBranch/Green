// Carrega e valida o conteúdo (árvore, provas e missões) a partir de content/.

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

  return content;
}
