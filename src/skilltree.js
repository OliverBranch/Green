// Regras da árvore: estado de cada nó, bônus ativos e progressão do operador.

import { content, TAG_LABELS } from './content.js';
import * as store from './state.js';

export const EXAM_SIZE = 4;
export const PASS_RATIO = 0.75;

export function progress(id) {
  return store.get().nodes[id] || { level: 0, cooldownUntil: 0, attempts: 0, provenAt: {} };
}

export function prereqsMet(node) {
  return node.requires.every((r) => progress(r).level >= 1);
}

export function pool(id, level) {
  return content.questions.get(id)?.[level] || [];
}

export function examShape(id, level) {
  const size = Math.min(EXAM_SIZE, pool(id, level).length);
  return { size, need: Math.ceil(size * PASS_RATIO) };
}

// Estados possíveis: locked, nosignal, available, cooldown, unlocked, mastered
export function status(node) {
  const p = progress(node.id);
  const level = p.level || 0;
  const next = level + 1;
  const now = Date.now();
  if (level >= 3) return { key: 'mastered', level, label: 'domínio comprovado' };
  if (level === 0 && !prereqsMet(node)) return { key: 'locked', level, next, label: 'bloqueado' };
  const cooldown = p.cooldownUntil > now ? p.cooldownUntil - now : 0;
  if (cooldown) return { key: 'cooldown', level, next, cooldown, label: 'em recarga' };
  const hasContent = pool(node.id, next).length >= 3;
  if (!hasContent) {
    return level
      ? { key: 'unlocked', level, next, noContent: true, label: `nível ${level}` }
      : { key: 'nosignal', level, next, noContent: true, label: 'sem sinal' };
  }
  return { key: level ? 'unlocked' : 'available', level, next, canExam: true, label: level ? `nível ${level}` : 'disponível' };
}

export function effectText(effect) {
  if (!effect) return '';
  const tag = TAG_LABELS[effect.tag] || effect.tag;
  switch (effect.kind) {
    case 'costReduction': return `−${effect.pct}% de energia em ações de ${tag}, por nível`;
    case 'noiseReduction': return `−${effect.pct}% de ruído em ações de ${tag}, por nível`;
    case 'xpBonus': return `+${effect.pct}% de XP em missões, por nível`;
    case 'unlock': return effect.text;
    default: return '';
  }
}

export function activeEffects() {
  const out = [];
  for (const n of content.nodes.values()) {
    const lv = progress(n.id).level;
    if (lv > 0 && n.bonus?.effect) out.push({ node: n, level: lv, effect: n.bonus.effect });
  }
  return out;
}

export function modsFor(tags = []) {
  let cost = 0, noise = 0, xp = 0;
  for (const { effect: e, level } of activeEffects()) {
    const v = ((e.pct || 0) * level) / 100;
    if (e.kind === 'xpBonus') xp += v;
    else if (e.tag && tags.includes(e.tag)) {
      if (e.kind === 'costReduction') cost += v;
      if (e.kind === 'noiseReduction') noise += v;
    }
  }
  return { costMul: Math.max(0.3, 1 - cost), noiseMul: Math.max(0.3, 1 - noise), xpMul: 1 + xp };
}

export function mastery() {
  let proven = 0;
  for (const n of content.nodes.values()) proven += progress(n.id).level;
  const total = content.nodes.size * 3;
  return { proven, total, pct: total ? proven / total : 0 };
}

export function branchMastery(branch) {
  let proven = 0;
  for (const n of branch.nodes) proven += progress(n.id).level;
  return { proven, total: branch.nodes.length * 3 };
}

const RANKS = [
  [0, 'Estagiário'],
  [300, 'Analista júnior'],
  [900, 'Analista pleno'],
  [2000, 'Analista sênior'],
  [4000, 'Especialista'],
  [7000, 'Arquiteto de segurança'],
];

export function rank(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
  const floor = RANKS[i][0];
  const ceil = RANKS[i + 1]?.[0] ?? null;
  return {
    level: i + 1,
    name: RANKS[i][1],
    floor, ceil,
    nextName: RANKS[i + 1]?.[1] ?? null,
    progress: ceil ? (xp - floor) / (ceil - floor) : 1,
  };
}
