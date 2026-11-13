// Ficha do analista: o XP de cada área da árvore vira atributos de combate.
//
// XP de área = 100 por nível comprovado em cada nó do ramo (metade se o nó estiver enferrujado)
//            + o XP ganho respondendo cartas daquele ramo nas operações.
// O XP vira um patamar de 0 a 5, e cada ramo alimenta um atributo diferente. Puro: recebe tudo por parâmetro.

export const TIERS = [0, 100, 250, 500, 900, 1400];
export const NODE_LEVEL_XP = 100;
export const CARD_XP = 2;      // por carta certa numa operação
export const CASE_XP = 10;     // por questão de caso certa

export const ATTRS = [
  {
    branch: 'redes', key: 'ap', name: 'Banda', icon: 'bolt', short: 'AP',
    text: 'Pontos de ação por turno (+1 no patamar 4). Patamar 2 dá um salto lateral por ato no mapa; patamar 5, dois.',
    value: (t) => 3 + (t >= 4 ? 1 : 0),
    fmt: (v) => `${v} por turno`,
  },
  {
    branch: 'fundamentos', key: 'hp', name: 'Integridade', icon: 'heart', short: 'HP',
    text: 'Integridade máxima no início da operação. Riscos, normas e os pilares: o quanto você aguenta.',
    value: (t) => 80 + 5 * t,
    fmt: (v) => `${v} máx.`,
  },
  {
    branch: 'governanca', key: 'armor', name: 'Armadura', icon: 'wall', short: 'ARM',
    text: 'Bloqueio automático no início de cada turno (+1 nos patamares 1, 3 e 5). Política, conformidade e continuidade mitigam sem esforço.',
    value: (t) => Math.floor((t + 1) / 2),
    fmt: (v) => `+${v} bloqueio/turno`,
  },
  {
    branch: 'cripto', key: 'crit', name: 'Crítico', icon: 'key', short: 'CRIT',
    text: 'Multiplicador de dano quando você responde rápido.',
    value: (t) => Math.round((1.5 + 0.1 * t) * 100) / 100,
    fmt: (v) => `×${v.toFixed(2)}`,
  },
  {
    branch: 'hardening', key: 'def', name: 'Defesa', icon: 'shield', short: 'DEF',
    text: 'Bloqueio gerado por cada carta de Defender acertada.',
    value: (t) => 5 + t,
    fmt: (v) => `${v} por carta`,
  },
  {
    branch: 'devsecops', key: 'atk', name: 'Ataque', icon: 'sword', short: 'ATK',
    text: 'Dano de cada carta de Atacar acertada.',
    value: (t) => 6 + t,
    fmt: (v) => `${v} por carta`,
  },
  {
    branch: 'defesa', key: 'analysis', name: 'Análise', icon: 'eye', short: 'ANL',
    text: 'Dano do contra-ataque quando você identifica a técnica no log e anula o golpe.',
    value: (t) => 8 + 2 * t,
    fmt: (v) => `${v} de contra-ataque`,
  },
  {
    branch: 'dados', key: 'recovery', name: 'Recuperação', icon: 'nobackup', short: 'REC',
    text: 'Integridade recuperada ao vencer cada combate. Backup bem feito volta rápido.',
    value: (t) => 2 * t,
    fmt: (v) => `+${v} por vitória`,
  },
  {
    branch: 'tendencias', key: 'timer', name: 'Reflexo', icon: 'brain', short: 'REF',
    text: 'Segundos a mais no cronômetro de todas as cartas.',
    value: (t) => 1.5 * t,
    fmt: (v) => `+${v.toFixed(1).replace('.0', '')} s`,
  },
];

export const BASE_ATTRS = Object.fromEntries(ATTRS.map((a) => [a.key, a.value(0)]));

export function tierOf(xp) {
  let t = 0;
  while (t + 1 < TIERS.length && xp >= TIERS[t + 1]) t++;
  return t;
}

export function tierProgress(xp) {
  const t = tierOf(xp);
  const floor = TIERS[t];
  const ceil = TIERS[t + 1] ?? null;
  return { tier: t, floor, ceil, pct: ceil ? (xp - floor) / (ceil - floor) : 1 };
}

// branches: [{ id, nodes: [{ id }] }]; level(id) -> 0..3; rusty(id) -> bool; extra: { branchId: xp das operações }
export function branchXp(branch, { level, rusty = () => false, extra = {} }) {
  let xp = 0;
  for (const n of branch.nodes) {
    const lv = level(n.id) || 0;
    xp += lv * NODE_LEVEL_XP * (rusty(n.id) ? 0.5 : 1);
  }
  return Math.round(xp + (extra[branch.id] || 0));
}

export function computeAttrs(branches, opts) {
  const out = { ...BASE_ATTRS, hops: 0, tiers: {}, xp: {} };
  for (const a of ATTRS) {
    const br = branches.find((b) => b.id === a.branch);
    const xp = br ? branchXp(br, opts) : 0;
    const t = tierOf(xp);
    out.xp[a.branch] = xp;
    out.tiers[a.branch] = t;
    out[a.key] = a.value(t);
  }
  const net = out.tiers.redes || 0;
  out.hops = net >= 5 ? 2 : net >= 2 ? 1 : 0;
  return out;
}
