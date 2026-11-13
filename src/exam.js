// Motor das provas de maestria.

import { content } from './content.js';
import * as store from './state.js';
import { pool, examShape } from './skilltree.js';

export const XP_PER_LEVEL = 100;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildExam(nodeId, level) {
  const { size, need } = examShape(nodeId, level);
  const items = shuffle(pool(nodeId, level)).slice(0, size).map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return { q, order, correct: order.indexOf(q.answer) };
  });
  return { nodeId, level, items, need, answers: [], startedAt: Date.now(), tabSwitches: 0 };
}

// Marca a prova como em andamento. Se a página for recarregada no meio, conta como reprovação.
export function beginExam(exam) {
  store.update((s) => { s.activeExam = { nodeId: exam.nodeId, level: exam.level, startedAt: exam.startedAt }; });
}

export function finishExam(exam) {
  const correctCount = exam.items.reduce((acc, it, i) => acc + (exam.answers[i] === it.correct ? 1 : 0), 0);
  const passed = correctCount >= exam.need;
  let xpGain = 0;
  store.update((s) => {
    s.activeExam = null;
    const p = store.nodeEntry(s, exam.nodeId);
    p.attempts++;
    s.stats.exams++;
    const t = Date.now();
    exam.items.forEach((it, i) => s.history.push({ q: it.q.id, ok: exam.answers[i] === it.correct, t }));
    if (s.history.length > 2000) s.history.splice(0, s.history.length - 2000);
    if (passed) {
      const wasNew = p.level < exam.level;
      p.level = Math.max(p.level, exam.level);
      p.cooldownUntil = 0;
      p.provenAt[exam.level] = p.provenAt[exam.level] || t;
      s.stats.passed++;
      if (wasNew) { xpGain = XP_PER_LEVEL * exam.level; s.xp += xpGain; }
    } else {
      p.cooldownUntil = t + s.settings.cooldownHours * 3600e3;
    }
  });
  return { correctCount, total: exam.items.length, passed, xpGain };
}

// Chamado na inicialização: uma prova abandonada (página recarregada ou fechada) conta como reprovação.
export function settleAbandoned() {
  const s = store.get();
  if (!s.activeExam) return null;
  const { nodeId, level } = s.activeExam;
  store.update((st) => {
    const p = store.nodeEntry(st, nodeId);
    p.attempts++;
    p.cooldownUntil = Date.now() + st.settings.cooldownHours * 3600e3;
    st.stats.exams++;
    st.activeExam = null;
  });
  return { node: content.nodes.get(nodeId), level };
}
