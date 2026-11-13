// Motor das missões: recursos, escolhas com consequência e relatório final.

import { content } from './content.js';
import * as store from './state.js';
import { progress, modsFor } from './skilltree.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function startRun(mission) {
  return {
    mission,
    step: 0,
    energy: mission.resources?.energy ?? 100,
    maxEnergy: mission.resources?.energy ?? 100,
    noise: 0,
    peakNoise: 0,
    rep: 0,
    xp: 0,
    flags: [],
    chosen: {},      // índice do passo -> ids escolhidos
    transcript: [],  // { title, label, outcome }
    status: 'running',
    failReason: null,
    report: null,
  };
}

export const currentStep = (run) => run.mission.steps[run.step];

export function optionLock(opt) {
  if (!opt.requires) return null;
  const need = opt.requires.level || 1;
  if (progress(opt.requires.node).level >= need) return null;
  return { node: content.nodes.get(opt.requires.node), level: need };
}

export function effectiveCost(opt) {
  const m = modsFor(opt.tags || []);
  const base = { energy: opt.cost?.energy || 0, noise: opt.cost?.noise || 0 };
  return {
    base,
    energy: Math.round(base.energy * m.costMul),
    noise: Math.round(base.noise * m.noiseMul),
  };
}

export function choose(run, opt) {
  const cost = effectiveCost(opt);
  run.energy = Math.max(0, run.energy - cost.energy);
  run.noise = clamp(run.noise + cost.noise, 0, 100);
  run.peakNoise = Math.max(run.peakNoise, run.noise);
  run.rep += opt.rep || 0;

  const picks = (run.chosen[run.step] ||= []);
  picks.push(opt.id);
  const retried = picks.length > 1;

  let xp = 0;
  if (opt.outcome === 'good') xp = opt.xp ?? 40;
  else if (opt.outcome === 'ok') xp = opt.xp ?? 20;
  if (retried && xp) xp = Math.round(xp / 2);
  run.xp += xp;
  if (opt.flag) run.flags.push(opt.flag);

  const step = currentStep(run);
  run.transcript.push({ title: step.title, label: opt.label, outcome: opt.outcome });

  if (run.noise >= 100) { run.status = 'failed'; run.failReason = 'noise'; }
  else if (run.energy <= 0) { run.status = 'failed'; run.failReason = 'energy'; }

  return { outcome: opt.outcome, cost, xp, advance: opt.outcome !== 'bad' && run.status === 'running' };
}

export function advance(run) {
  run.step++;
  if (run.step >= run.mission.steps.length) run.status = 'done';
}

export function submitReport(run, selected) {
  const step = currentStep(run);
  const total = step.items.filter((i) => i.correct).length;
  let hits = 0, wrong = 0;
  for (const it of step.items) {
    const sel = selected.includes(it.id);
    if (it.correct && sel) hits++;
    if (!it.correct && sel) wrong++;
  }
  const score = Math.max(0, (hits - wrong) / total);
  const xp = Math.round((step.xp || 150) * score);
  run.xp += xp;
  run.report = { hits, wrong, total, score, xp, selected };
  run.status = 'done';
  return run.report;
}

export function grade(score) {
  if (score >= 0.95) return 'S';
  if (score >= 0.75) return 'A';
  if (score >= 0.5) return 'B';
  return 'C';
}

// Aplica o resultado da missão ao save. Primeira conclusão vale XP cheio; repetições valem 25%.
export function finalize(run) {
  const id = run.mission.id;
  const prev = store.get().missions[id];
  const first = !prev?.completions;
  const done = run.status === 'done';
  const { xpMul } = modsFor([]);
  const xp = done ? Math.round(run.xp * xpMul * (first ? 1 : 0.25)) : 0;
  store.update((s) => {
    const r = (s.missions[id] ||= { completions: 0, best: 0, lastAt: 0 });
    if (done) {
      r.completions++;
      r.best = Math.max(r.best, run.report?.score || 0);
      s.stats.missions++;
    } else {
      s.stats.missionsFailed++;
    }
    r.lastAt = Date.now();
    s.xp += xp;
    s.reputation = clamp(s.reputation + run.rep, 0, 100);
  });
  return { xp, first, xpMul };
}
