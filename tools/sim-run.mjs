// Simulador de operações completas (modo roguelike, combate por cartas da 0.4).
// Uso: node tools/sim-run.mjs [operações por linha] [ameaça]
//
// Um robô joga milhares de operações. Ele acerta cada carta com uma probabilidade fixa (flashcards), um pouco
// menos nos logs e nos casos de chefe, e responde rápido em parte dos acertos. A política é a de um jogador
// razoável: analisa o log quando o golpe anunciado é grande, defende quando o golpe passaria do bloqueio e
// ataca com o resto. Os perfis variam os patamares da ficha do analista (atributos vindos do estudo).

import { readFileSync } from 'node:fs';
import { openCard, answerCard, openCase, endTurn, canAct, useScript, canUseScript, intentView } from '../src/battle.js';
import { computeAttrs, TIERS } from '../src/attributes.js';
import * as R from '../src/run.js';

const root = new URL('../content/', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const manifest = read('manifest.json');
const techniques = new Map([].concat(manifest.battle.techniques).flatMap((f) => read(f).techniques).map((t) => [t.id, t]));
const rn = manifest.run;
const monsters = read(rn.monsters).monsters;
const bosses = read(rn.bosses).bosses;
const affixes = new Map(read(rn.affixes).affixes.map((a) => [a.id, a]));
const items = read(rn.items);
const relics = new Map(items.relics.map((r) => [r.id, r]));
const scripts = new Map(items.scripts.map((s) => [s.id, s]));
const events = read(rn.events).events;
const cards = read(rn.flashcards).cards;
const tree = read(manifest.tree);
const branchOfMap = new Map(tree.branches.flatMap((b) => b.nodes.map((n) => [n.id, b.id])));
const questions = new Map();
for (const f of manifest.exams) for (const q of read(f).questions) {
  const k = `${q.node}:${q.level}`;
  if (!questions.has(k)) questions.set(k, []);
  questions.get(k).push(q);
}

const RUNS = Number(process.argv[2] || 300);
const THREAT = Number(process.argv[3] || 0);

// perfis: XP de área por ramo (o mesmo em todos os ramos)
const PROFILES = {
  'nada estudado (patamar 0)': 0,
  'um nó por ramo (patamar 1)': TIERS[1],
  'patamar 2 em tudo': TIERS[2],
  'patamar 3 em tudo': TIERS[3],
};

function makeData(levels = {}) {
  const rust = new Set();
  return {
    monsters, bosses, affixes, relics, scripts, events, techniques, cards,
    branchOf: (n) => branchOfMap.get(n),
    level: (id) => levels[id] || 0,
    nodeName: (id) => id,
    questions: (n, lv) => questions.get(`${n}:${lv}`) || [],
    questionNodes: () => [...new Set([...questions.keys()].map((k) => k.split(':')[0]))],
    rust: { list: () => [...rust], clear: (n) => rust.delete(n), add: (n) => rust.add(n) },
  };
}

function attrsFor(xp) {
  const extra = Object.fromEntries(tree.branches.map((b) => [b.id, xp]));
  return computeAttrs(tree.branches, { level: () => 0, extra });
}

// ---------- robô ----------

function answer(b, card, acc, fastRate) {
  const ok = Math.random() < acc;
  const fast = ok && Math.random() < fastRate;
  const pick = ok ? card.answer : card.options.findIndex((_, i) => i !== card.answer && !card.cut.includes(i));
  const ms = fast ? card.time * 1000 * 0.3 : card.time * 1000 * 0.7;
  let res = answerCard(b, pick, ms);
  if (res?.retry) res = answerCard(b, Math.random() < acc ? card.answer : pick === 0 ? 1 : 0, ms);
  return res;
}

function playBattle(b, { acc, logAcc, caseAcc, fastRate }) {
  let guard = 0;
  while (b.status === 'running' && guard++ < 60) {
    // scripts em momentos óbvios
    for (let i = b.scripts.length - 1; i >= 0; i--) {
      if (!canUseScript(b, i).ok) continue;
      const e = scripts.get(b.scripts[i]).effects;
      if ((e.heal && b.hp < b.maxHp * 0.4) || (e.flatDamage && b.foe.hp <= 14) || (e.ap && b.enc.kind === 'boss') ||
        (e.expose && b.enc.kind !== 'combat') || (e.block && intentView(b).dmg * intentView(b).hits >= 14) || (e.cleanse && (b.you.vazamento || b.you.credencial))) useScript(b, i);
    }
    let steps = 0;
    while (b.status === 'running' && steps++ < 10) {
      if (b.pendingCase) { const c = openCase(b); if (c) answer(b, c, caseAcc, 0); continue; }
      const iv = intentView(b);
      const incoming = iv.negated || iv.stunned ? 0 : iv.dmg * iv.hits;
      const need = incoming - b.block;
      const killable = b.foe.hp + b.foe.block <= b.attrs.atk * (b.foe.exposto ? 1.5 : 1);
      let act = null;
      if (canAct(b, 'analyze').ok && incoming >= Math.max(8, b.attrs.def * 1.3) && !killable) act = 'analyze';
      else if (need > 0 && need >= b.attrs.def * 0.6 && canAct(b, 'defend').ok && !killable && b.hp < b.maxHp * 0.85 + need) act = 'defend';
      else if (canAct(b, 'attack').ok) act = 'attack';
      if (!act) break;
      const card = openCard(b, act);
      answer(b, card, act === 'analyze' ? logAcc : acc, fastRate);
    }
    if (b.status === 'running' && !b.pendingCase) endTurn(b);
  }
}

function choosePath(run) {
  const opts = [...R.reachable(run), ...R.hopTargets(run)];
  const hpPct = run.hp / run.maxHp;
  const score = (id) => {
    const t = run.map.nodes[id].type;
    const base = { combat: 3, elite: hpPct > 0.75 ? 4 : -2, event: 3, rest: hpPct < 0.6 ? 6 : 1, shop: run.credits > 90 ? 5 : 1, treasure: 6, boss: 0 }[t] || 0;
    const hopCost = R.reachable(run).includes(id) ? 0 : 2.5;
    return base + Math.random() - hopCost;
  };
  return opts.sort((a, b) => score(b) - score(a))[0];
}

function simRun(attrs, skill, threat = 0) {
  const data = makeData();
  const run = R.newRun({ seed: Math.floor(Math.random() * 2 ** 31), data, attrs, threat });
  let guard = 0;
  while (!['dead', 'won'].includes(run.status) && guard++ < 400) {
    if (run.status === 'map') { R.enterNode(run, choosePath(run), data); continue; }
    if (run.status === 'battle') {
      const b = R.startBattle(run, data);
      playBattle(b, skill);
      R.finishBattle(run, b, data);
      continue;
    }
    if (run.status === 'reward') {
      const rw = run.pending.rewards;
      R.claimRewards(run, data, { take: rw.items.map((i) => i.id), relicChoice: rw.relicChoice[0] || null });
      if (run.status === 'act') R.continueToMap(run);
      continue;
    }
    if (run.status === 'event') {
      const ev = data.events.find((e) => e.id === run.pending.eventId);
      const ok = ev.choices.map((c, i) => [c, i]).filter(([c]) => R.requirementMet(run, data, c.requires).ok);
      const [, i] = ok.find(([x]) => x.quiz) || ok[Math.floor(Math.random() * ok.length)];
      const res = R.chooseEvent(run, data, i);
      if (res?.quiz) R.answerEventQuiz(run, data, Math.random() < skill.caseAcc);
      if (run.status === 'event') R.continueToMap(run);
      continue;
    }
    if (run.status === 'rest') {
      if (run.hp / run.maxHp < 0.65) R.restSleep(run);
      else { const q = R.pickQuestion(run, data, []); R.restStudy(run, data, Math.random() < skill.caseAcc, q); }
      R.continueToMap(run); continue;
    }
    if (run.status === 'shop') {
      for (const it of run.pending.stock.slice().sort((a, b) => (b.type === 'relic') - (a.type === 'relic'))) {
        if (it.type === 'heal' && run.hp / run.maxHp > 0.7) continue;
        R.buy(run, data, it.id);
      }
      R.continueToMap(run); continue;
    }
    R.continueToMap(run);
  }
  return run;
}

console.log(`ameaça ${THREAT} · ${RUNS} operações por linha`);
const ACCS = (process.env.ACCS || '0.5,0.7,0.85,0.95').split(',').map(Number);
const only = process.env.PROFILE;
for (const [name, xp] of Object.entries(PROFILES)) {
  if (only && !name.includes(only)) continue;
  const attrs = attrsFor(xp);
  console.log(`\n${name}  ·  AP ${attrs.ap} HP ${attrs.hp} ATK ${attrs.atk} DEF ${attrs.def} ANL ${attrs.analysis} CRIT ${attrs.crit} ARM ${attrs.armor}`);
  console.log('acerto  vitória  morreu no ato 1 / 2 / 3   em chefe   cartas/combate   dano/combate');
  for (const acc of ACCS) {
    const skill = { acc, logAcc: Math.max(0.25, acc - 0.1), caseAcc: Math.max(0.25, acc - 0.1), fastRate: 0.4 };
    let wins = 0, diedBoss = 0, cardsN = 0, fights = 0, dmg = 0;
    const diedAct = [0, 0, 0, 0];
    const killers = {};
    for (let i = 0; i < RUNS; i++) {
      const r = simRun(attrs, skill, THREAT);
      cardsN += r.stats.cards;
      fights += r.stats.fights + r.stats.elites + r.stats.bosses + (r.status === 'dead' ? 1 : 0);
      dmg += r.stats.dmgTaken;
      if (r.status === 'won') wins++;
      else { diedAct[r.act]++; if (r.path.at(-1)?.includes('boss')) diedBoss++; killers[r.deathBy] = (killers[r.deathBy] || 0) + 1; }
    }
    const pct = (n) => `${((n / RUNS) * 100).toFixed(0)}%`.padStart(5);
    console.log(` ${acc.toFixed(2)}   ${pct(wins)}       ${pct(diedAct[1])} ${pct(diedAct[2])} ${pct(diedAct[3])}        ${pct(diedBoss)}        ${(cardsN / fights).toFixed(1).padStart(5)}          ${(dmg / fights).toFixed(1)}`);
    if (acc === 0.85 && process.env.KILLERS) console.log('   quem mais derrota:', Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · '));
  }
}
