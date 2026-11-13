// Operação (modo roguelike): página inicial, mapa procedural, nós, recompensas e relatório final.

import { h, s as svg, mount, confirmDialog, trapFocus } from './dom.js';
import { content, LEVELS } from '../content.js';
import * as store from '../state.js';
import { status as nodeStatus, modsFor } from '../skilltree.js';
import { INTENT_TYPES } from '../battle.js';
import { ATTRS, computeAttrs, tierProgress } from '../attributes.js';
import * as R from '../run.js';
import { mountBattle, portrait, icon, pips, nodeName, answersReview, intentLine } from './battle-view.js';
import { PALETTE as P, iconURL } from './pixel.js';
import { sfx } from './sfx.js';
import { log } from './console.js';

// ---------- dados para o motor ----------

function runData() {
  const s = store.get();
  return {
    monsters: content.run.monsters,
    bosses: content.run.bosses,
    affixes: content.run.affixes,
    relics: content.run.relics,
    scripts: content.run.scripts,
    events: content.run.events,
    techniques: content.battle.techniques,
    cards: content.run.cards,
    branchOf: (id) => content.nodes.get(id)?.branch || null,
    level: (id) => s.nodes[id]?.level || 0,
    nodeName,
    questions: (n, lv) => content.questions.get(n)?.[lv] || [],
    questionNodes: () => [...content.questions.keys()].filter((n) => [1, 2].some((lv) => content.questions.get(n)[lv].length)),
    rust: {
      list: () => Object.keys(store.get().rust || {}),
      clear: (n) => { delete store.get().rust[n]; },
      add: (n) => { (store.get().rust ||= {})[n] = Date.now(); },
    },
  };
}

const persist = () => store.save();
const active = (run) => run && !['dead', 'won'].includes(run.status);

function enemyOf(id) {
  return content.run.monsters.find((m) => m.id === id) || content.run.bosses.find((b) => b.id === id);
}

function relicChip(r, cls = '') {
  return h('span', { class: `relic ${cls} is-${r.rarity}`, title: `${r.name}: ${r.text}`, tabindex: '0' }, icon(r.icon, r.rarity === 'chefe' ? P.R : r.rarity === 'rara' ? P.A : P.G, 'pix-icon'), h('span', { class: 'relic-name' }, r.name));
}

function nodeChips(ids = []) {
  return ids.map((id) => {
    const n = content.nodes.get(id);
    if (!n) return null;
    const st = nodeStatus(n);
    return h('span', { class: `chip is-${st.key}`, title: `${n.name} · ${st.label}` }, n.code);
  });
}

function hpBar(run) {
  const pct = Math.max(0, Math.min(100, (run.hp / run.maxHp) * 100));
  return h('span', { class: `run-hp${pct < 35 ? ' is-low' : ''}`, title: `Integridade ${run.hp}/${run.maxHp}` },
    icon('heart', pct < 35 ? P.R : P.G, 'pix-icon is-sm'),
    h('span', { class: 'run-hp-bar' }, h('span', { style: { width: `${pct}%` } })),
    h('b', {}, `${run.hp}/${run.maxHp}`));
}

// ---------- ficha do analista ----------

export function playerAttrs() {
  const s = store.get();
  return computeAttrs(content.branches, {
    level: (id) => s.nodes[id]?.level || 0,
    rusty: (id) => !!s.rust?.[id],
    extra: s.areaXp || {},
  });
}

const branchName = (id) => content.branches.find((b) => b.id === id)?.name || id;

// Ficha completa: um cartão por atributo, com o ramo que o alimenta e o progresso até o próximo patamar.
export function sheet(attrs, { onNode, compact = false } = {}) {
  const s = store.get();
  return h('ul', { class: `sheet${compact ? ' is-compact' : ''}` }, ATTRS.map((a) => {
    const xp = attrs.xp[a.branch] || 0;
    const tp = tierProgress(xp);
    const br = content.branches.find((b) => b.id === a.branch);
    const rusty = br ? br.nodes.filter((n) => s.rust?.[n.id]).length : 0;
    if (compact) {
      return h('li', { class: 'sheet-mini', title: `${a.name}: ${a.text} · ${branchName(a.branch)}, patamar ${tp.tier}` },
        icon(a.icon, tp.tier ? P.G : P.m, 'pix-icon is-sm'), h('span', {}, a.short), h('b', {}, a.fmt(attrs[a.key]).split(' ')[0]));
    }
    const next = tp.ceil != null ? a.value(tp.tier + 1) : null;
    return h('li', { class: `sheet-card${tp.tier ? '' : ' is-zero'}` },
      h('div', { class: 'sheet-top' }, icon(a.icon, tp.tier ? P.G : P.m, 'pix-icon'), h('b', {}, a.name), h('span', { class: 'sheet-val' }, a.fmt(attrs[a.key]))),
      h('p', { class: 'sheet-branch' }, branchName(a.branch), h('span', {}, ` · patamar ${tp.tier}/5`)),
      h('div', { class: 'sheet-bar', title: tp.ceil != null ? `${xp}/${tp.ceil} XP de área` : 'patamar máximo' }, h('span', { style: { width: `${Math.round(tp.pct * 100)}%` } })),
      h('p', { class: 'sheet-next' }, tp.ceil != null ? `${xp}/${tp.ceil} xp · próximo: ${a.fmt(next)}` : `${xp} xp · máximo`),
      h('p', { class: 'sheet-text' }, a.text),
      rusty ? h('p', { class: 'sheet-rust' }, icon('chain', P.A, 'pix-icon is-sm'), `${rusty} nó(s) enferrujado(s) contam metade`) : null,
      onNode && br ? h('p', { class: 'sheet-nodes' }, br.nodes.map((n, i) => [i ? ' ' : '', h('button', { class: `link-btn is-${nodeStatus(n).key}`, title: `${n.name} · ${nodeStatus(n).label}`, onclick: () => onNode(n.id) }, n.code)])) : null);
  }));
}

// ---------- página ----------

export function mountOperation(container, { onNode }) {
  function render() {
    const s = store.get();
    const run = s.run;
    const attrs = playerAttrs();
    const best = s.bestiary || {};
    const beast = (m, isBoss) => {
      const rec = best[m.id];
      const seen = rec?.met > 0;
      return h('li', { class: `beast${seen ? '' : ' is-unseen'}${isBoss ? ' is-boss' : ''}`, title: seen ? m.flavor || m.briefing || '' : 'Ainda não encontrado' },
        h('div', { class: 'beast-art' }, portrait(m.sprite, isBoss ? 2 : 2)),
        h('b', {}, seen ? m.name : '???'),
        h('span', { class: 'beast-topic' }, m.topic),
        h('span', { class: 'beast-nodes' }, nodeChips(m.nodes)),
        h('span', { class: 'beast-rec' }, seen ? `${rec.beaten || 0}/${rec.met} vencidos` : isBoss ? `chefe do ato ${m.act}` : `atos ${m.acts.join(', ')}`));
    };

    const threats = R.THREATS.filter((t) => t.n <= (s.maxThreat || 0));
    const threatSel = Math.min(s.maxThreat || 0, Number(container.dataset.threat ?? s.maxThreat ?? 0));
    const live = active(run);

    // escalação de chefes: dois por ato; na operação em andamento, o sorteado aparece em destaque
    const lineup = h('div', { class: 'op-lineup', 'aria-label': 'Chefes por ato' }, [1, 2, 3].map((act) => {
      const bosses = content.run.bosses.filter((b) => b.act === act);
      const cleared = live && run.act > act;
      const here = live && run.act === act;
      return h('div', { class: `lineup-act${here ? ' is-here' : ''}${cleared ? ' is-cleared' : ''}` },
        h('p', { class: 'lineup-k' }, `ato ${act}`, h('span', {}, R.ACT_NAMES[act].toLowerCase())),
        bosses.map((b) => {
          const seen = best[b.id]?.met > 0;
          const chosen = live && run.bosses?.[act] === b.id;
          return h('div', { class: `lineup-boss${seen ? '' : ' is-unseen'}${live && !chosen ? ' is-out' : ''}${chosen ? ' is-chosen' : ''}`, title: seen ? `${b.name} · ${b.topic}` : `Chefe do ato ${act} · ainda não encontrado` },
            portrait(b.sprite, 2),
            h('span', {}, seen || chosen ? b.name : '???'));
        }),
        cleared ? h('p', { class: 'lineup-mark' }, 'contido') : here ? h('p', { class: 'lineup-mark is-here' }, 'você está aqui') : null);
    }));

    const cta = live
      ? h('div', { class: 'op-run' },
        h('p', { class: 'op-kicker' }, h('i', { class: 'nav-dot' }), `em andamento · ameaça ${run.threat || 0}`),
        h('h2', { class: 'op-title' }, `Ato ${run.act} · ${R.ACT_NAMES[run.act]}`),
        h('div', { class: 'op-stats' }, hpBar(run), h('span', { class: 'run-cr' }, icon('coin', P.A, 'pix-icon is-sm'), `${run.credits}`), h('span', {}, `andar ${run.floor}`), h('span', {}, `${run.relics.length} ferramenta(s)`)),
        h('div', { class: 'op-actions' },
          h('button', { class: 'btn btn-primary btn-big', onclick: () => openRun({ onNode }) }, 'Continuar operação'),
          h('button', { class: 'btn btn-ghost btn-small', onclick: abandon }, 'Abandonar')))
      : h('div', { class: 'op-run' },
        threats.length > 1 ? h('div', { class: 'op-threats', role: 'group', 'aria-label': 'Nível de ameaça' },
          h('p', { class: 'op-kicker' }, 'nível de ameaça'),
          h('div', { class: 'threat-pills' }, threats.map((t) => h('button', {
            class: `threat-pill${t.n === threatSel ? ' is-on' : ''}`, 'aria-pressed': String(t.n === threatSel), title: t.text,
            onclick: () => { container.dataset.threat = String(t.n); sfx.click(); render(); },
          }, String(t.n)))),
          h('p', { class: 'threat-desc' }, h('b', {}, R.THREATS[threatSel].name), ` · ${R.THREATS[threatSel].text}`))
          : h('p', { class: 'threat-desc' }, 'Vencer uma operação libera o próximo nível de ameaça.'),
        h('div', { class: 'op-actions' },
          h('button', { class: 'btn btn-primary btn-big', onclick: () => start(threatSel) }, 'Iniciar operação')),
        h('p', { class: 'op-note' }, 'Os chefes são sorteados no início. Seus atributos ficam fixos durante a operação: são os da ficha abaixo.'));

    const runs = s.runs || [];
    const bestAct = runs.reduce((m, r) => Math.max(m, r.won ? 4 : r.act || 0), 0);
    const kpi = (label, value, sub) => h('li', { class: 'kpi' }, h('span', { class: 'kpi-k' }, label), h('b', {}, value), sub ? h('span', { class: 'kpi-sub' }, sub) : null);
    const kpis = h('ul', { class: 'op-kpis' },
      kpi('operações', `${s.stats.runsWon || 0}/${s.stats.runs || 0}`, 'vencidas'),
      kpi('melhor resultado', bestAct === 4 ? 'vitória' : bestAct ? `ato ${bestAct}` : '—', bestAct === 4 ? 'os três chefes' : bestAct ? 'mais longe que chegou' : 'nenhuma ainda'),
      kpi('acerto nas cartas', s.stats.cards ? `${Math.round(((s.stats.cardsOk || 0) / s.stats.cards) * 100)}%` : '—', s.stats.cards ? `${s.stats.cards} cartas` : 'jogue para medir'),
      kpi('ameaça liberada', `${s.maxThreat || 0}/${R.THREATS.length - 1}`, R.THREATS[s.maxThreat || 0].name.toLowerCase()));

    const how = (s.stats.runs || 0) < 3 ? h('ol', { class: 'op-how' },
      h('li', {}, icon('net', P.G, 'pix-icon is-big'), h('div', {}, h('b', {}, 'Escolha a rota'), h('span', {}, 'Mapa gerado na hora: incidentes, elites, imprevistos, plantões e mercado até o chefe.'))),
      h('li', {}, icon('sword', P.G, 'pix-icon is-big'), h('div', {}, h('b', {}, 'Cada ação é uma carta'), h('span', {}, 'Atacar, defender ou analisar o log. Acertou, a ação acontece; rápido, é crítico.'))),
      h('li', {}, icon('brain', P.G, 'pix-icon is-big'), h('div', {}, h('b', {}, 'Estudo vira atributo'), h('span', {}, 'Cada nível comprovado nas provas fortalece o seu analista.')))) : null;

    mount(container, h('div', { class: 'page op-page' },
      s.notice ? h('p', { class: 'panel-note is-warn op-notice' }, s.notice, ' ', h('button', { class: 'link-btn', onclick: () => store.update((x) => { delete x.notice; }) }, 'ok')) : null,
      h('section', { class: `op-hero${live ? ' is-live' : ''}` },
        h('div', { class: 'op-hero-main' },
          h('p', { class: 'op-kicker' }, 'modo roguelike · 3 atos · 6 chefes'),
          h('h1', { class: 'page-title' }, 'Operação'),
          h('p', { class: 'op-lead' }, 'Escolha a rota, enfrente os atacantes e derrube o chefe de cada ato. Cada monstro é um tema que você estuda. Morreu, recomeça do zero: o que fica é o que você aprendeu.'),
          cta),
        lineup),
      kpis,
      how,
      h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Ficha do analista'),
        h('p', { class: 'sec-lead' }, 'Cada ramo da árvore alimenta um atributo. O XP de área vem de cada nível comprovado nas provas (100 por nível) e de cada carta certa nas operações. Escolha o que estudar na semana pensando no analista que você quer ter.'),
        sheet(attrs, { onNode })),
      h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Bestiário'),
        h('p', { class: 'sec-lead' }, 'Cada atacante é um tema de estudo. Os códigos são os nós da árvore que cobrem o assunto.'),
        h('h3', { class: 'beast-h' }, 'Chefes'),
        h('ul', { class: 'bestiary is-bosses' }, content.run.bosses.map((b) => beast(b, true))),
        h('h3', { class: 'beast-h' }, 'Atacantes'),
        h('ul', { class: 'bestiary' }, content.run.monsters.map((m) => beast(m, false)))),
      runs.length ? h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Histórico'),
        h('ul', { class: 'runs' }, runs.slice().reverse().slice(0, 10).map((r) => h('li', { class: r.won ? 'is-won' : '' },
          h('span', { class: 'runs-when' }, new Date(r.at).toLocaleDateString('pt-BR')),
          h('b', {}, r.won ? 'vitória' : `caiu no ato ${r.act}`),
          h('span', {}, `ameaça ${r.threat} · andar ${r.floor} · acerto ${Math.round(r.acc * 100)}%`),
          h('span', { class: 'runs-by' }, r.won ? `+${r.xp} xp` : r.by ? `derrubado por ${r.by}` : ''))))) : null));
  }

  function start(threat) {
    const data = runData();
    const run = R.newRun({ seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, data, attrs: playerAttrs(), threat });
    store.update((s) => { s.run = run; });
    log(`operação iniciada · ameaça ${threat}`, 'info');
    openRun({ onNode });
  }

  async function abandon() {
    const ok = await confirmDialog({ title: 'Abandonar a operação?', text: 'Ela termina aqui e entra no histórico como derrota. O XP já conquistado é mantido.', ok: 'Abandonar', danger: true });
    if (!ok) return;
    const run = store.get().run;
    run.status = 'dead';
    run.deathBy = 'abandono';
    run.endedAt = Date.now();
    finalizeRun(run);
    persist();
  }

  render();
  return { destroy: store.subscribe(render) };
}

// ---------- fim da operação: XP, histórico e liberações ----------

function finalizeRun(run) {
  if (run.finalized) return run.finalized;
  const { xpMul } = modsFor([]);
  const xp = Math.round(run.xp * xpMul);
  const sum = R.summary(run);
  const won = run.status === 'won';
  let unlocked = null;
  const before = playerAttrs();
  store.update((s) => {
    s.areaXp ||= {};
    for (const [br, v] of Object.entries(run.areaXp || {})) s.areaXp[br] = (s.areaXp[br] || 0) + v;
    s.xp += xp;
    s.reputation = Math.max(0, Math.min(100, s.reputation + (won ? 8 : -2)));
    s.stats.runs = (s.stats.runs || 0) + 1;
    if (won) {
      s.stats.runsWon = (s.stats.runsWon || 0) + 1;
      if ((run.threat || 0) >= (s.maxThreat || 0) && (s.maxThreat || 0) < R.THREATS.length - 1) { s.maxThreat = (run.threat || 0) + 1; unlocked = s.maxThreat; }
    }
    s.stats.cards = (s.stats.cards || 0) + run.stats.cards;
    s.stats.cardsOk = (s.stats.cardsOk || 0) + run.stats.correct;
    s.runs = [...(s.runs || []), { at: Date.now(), won, act: run.act, floor: run.floor, threat: run.threat || 0, acc: sum.acc, xp, by: run.deathBy || null }].slice(-30);
  });
  const after = playerAttrs();
  const tierUps = ATTRS.filter((a) => (after.tiers[a.branch] || 0) > (before.tiers[a.branch] || 0)).map((a) => ({ attr: a, tier: after.tiers[a.branch], value: after[a.key] }));
  run.finalized = { xp, unlocked, tierUps };
  log(won ? `[ok] operação vencida · +${xp} xp` : `[falha] operação encerrada no ato ${run.act} · +${xp} xp`, won ? 'ok' : 'alert');
  return run.finalized;
}

// ---------- tela da operação ----------

export function openRun({ onNode } = {}) {
  const s0 = store.get();
  if (!s0.run) return;
  const data = runData();
  const frame = h('div', { class: 'overlay-frame inc-frame run-frame' });
  const overlay = h('div', { class: 'overlay inc-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Operação' }, frame);
  document.body.appendChild(overlay);
  document.body.classList.add('has-overlay');
  const release = trapFocus(overlay);
  let battle = null;       // { b, view }
  let local = {};          // estado de tela que não vai para o save (quiz respondido, etc.)

  const run = () => store.get().run;

  function close() {
    battle?.view?.destroy();
    release();
    overlay.remove();
    if (!document.querySelector('.overlay')) document.body.classList.remove('has-overlay');
  }

  async function requestClose() {
    if (battle && battle.b.status === 'running') {
      const ok = await confirmDialog({ title: 'Sair no meio do combate?', text: 'A operação fica salva, mas este combate recomeça do início quando você voltar.', ok: 'Sair', danger: false });
      if (!ok) return;
    }
    close();
  }

  function head(title, extra = null) {
    const r = run();
    const sound = store.get().settings.sound;
    return h('header', { class: 'run-head op-head' },
      h('span', { class: 'exam-kicker' }, `operação · ameaça ${r.threat || 0} · ato ${r.act} ${R.ACT_NAMES[r.act].toLowerCase()} · andar ${r.floor}`),
      h('h1', { class: 'run-title' }, title),
      extra,
      h('div', { class: 'op-strip' },
        hpBar(r),
        h('span', { class: 'run-cr', title: 'Créditos' }, icon('coin', P.A, 'pix-icon is-sm'), h('b', {}, String(r.credits))),
        h('span', { class: 'op-relics' }, r.relics.map((id) => {
          const rel = data.relics.get(id);
          return rel ? h('span', { class: `relic-dot is-${rel.rarity}`, title: `${rel.name}: ${rel.text}`, tabindex: '0' }, icon(rel.icon, rel.rarity === 'chefe' ? P.R : rel.rarity === 'rara' ? P.A : P.G, 'pix-icon is-sm')) : null;
        })),
        h('span', { class: 'op-scripts', title: 'Scripts' }, Array.from({ length: R.scriptSlots(r, data) }, (_, i) => {
          const sc = data.scripts.get(r.scripts[i]);
          return h('span', { class: `scr-dot${sc ? '' : ' is-empty'}`, title: sc ? `${sc.name}: ${sc.text}` : 'vaga de script vazia' }, sc ? icon(sc.icon, P.A, 'pix-icon is-sm') : '');
        }))),
      h('button', {
        class: 'icon-btn', title: sound ? 'Som ligado' : 'Som desligado', 'aria-label': sound ? 'Desligar som' : 'Ligar som',
        onclick: () => { store.update((s) => { s.settings.sound = !s.settings.sound; }); render(); },
      }, sound ? '♪' : '×'),
      h('button', { class: 'btn btn-ghost btn-small', onclick: requestClose }, 'Fechar'));
  }

  function render() {
    const r = run();
    if (!r) return close();
    if (battle && r.status === 'battle') return;
    switch (r.status) {
      case 'map': return renderMap();
      case 'battle': return renderIntro();
      case 'reward': return renderReward();
      case 'act': return renderAct();
      case 'event': return renderEvent();
      case 'rest': return renderRest();
      case 'shop': return renderShop();
      case 'treasure': return renderTreasure();
      case 'dead':
      case 'won': return renderEnd();
      default: return renderMap();
    }
  }

  function body(...children) {
    return h('div', { class: 'exam-body op-body' }, ...children);
  }

  // ----- mapa -----

  function renderMap() {
    const r = run();
    const map = r.map;
    const can = new Set(R.reachable(r));
    const hops = new Set(R.hopTargets(r));
    const visited = new Set(r.path);
    const nodes = Object.values(map.nodes);
    const VW = 520, VH = 980;
    const pos = (n) => {
      if (n.type === 'boss') return { x: VW / 2, y: 56 };
      const jx = ((n.row * 7 + n.col * 13) % 9) - 4;
      const jy = ((n.row * 11 + n.col * 5) % 7) - 3;
      return { x: 60 + n.col * 100 + jx * 2, y: VH - 60 - n.row * 108 + jy * 2 };
    };
    const edges = [];
    for (const n of nodes) for (const t of n.next) {
      const a = pos(n), b = pos(map.nodes[t]);
      const walked = visited.has(n.id) && visited.has(t) && r.path.indexOf(t) === r.path.indexOf(n.id) + 1;
      const open = r.pos === n.id && can.has(t);
      edges.push(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `map-edge${walked ? ' is-walked' : ''}${open ? ' is-open' : ''}` }));
    }
    if (r.pos) for (const t of hops) {
      const a = pos(map.nodes[r.pos]), b = pos(map.nodes[t]);
      edges.push(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'map-edge is-hop' }));
    }
    // um salto já usado aparece tracejado no caminho percorrido
    for (let i = 1; i < r.path.length; i++) {
      const from = map.nodes[r.path[i - 1]], to = map.nodes[r.path[i]];
      if (from && to && !from.next.includes(to.id)) { const a = pos(from), b = pos(to); edges.push(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'map-edge is-hop is-walked' })); }
    }
    const boss = data.bosses.find((b) => b.id === r.bosses[r.act]);
    const typeColor = { combat: P.G, elite: P.R, event: P.W, rest: P.G, shop: P.A, treasure: P.A, boss: P.R };
    const typeIcon = { combat: 'sword', elite: 'skull', event: 'ask', rest: 'cup', shop: 'coin', treasure: 'chest', boss: 'skull' };
    const nodeEls = nodes.map((n) => {
      const p = pos(n);
      const isHop = hops.has(n.id);
      const isCan = can.has(n.id) || isHop;
      const isHere = r.pos === n.id;
      const done = visited.has(n.id);
      const big = n.type === 'boss';
      const rad = big ? 34 : 19;
      const T = R.NODE_TYPES[n.type];
      const g = svg('g', {
        class: `map-node is-${n.type}${isCan ? ' is-can' : ''}${isHop ? ' is-hop' : ''}${isHere ? ' is-here' : ''}${done ? ' is-done' : ''}`,
        transform: `translate(${p.x} ${p.y})`,
        tabindex: isCan ? '0' : null, role: isCan ? 'button' : null,
        'aria-label': `${T.name}${isHop ? ', salto lateral' : isCan ? ', disponível' : ''}`,
        onclick: isCan ? () => go(n.id) : null,
        onkeydown: isCan ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(n.id); } } : null,
      },
        svg('title', {}, `${T.name}: ${T.desc}${isHop ? ' (gasta um salto lateral)' : ''}`),
        isCan ? svg('circle', { r: rad + 9, class: 'map-pulse' }) : null,
        svg('circle', { r: rad, class: 'map-disc' }),
        big ? null : svg('image', { href: iconURLFor(typeIcon[n.type], done && !isHere ? P.m : typeColor[n.type]), x: -12, y: -12, width: 24, height: 24, class: 'pix' }),
        big ? svg('image', { href: portraitURL(boss.sprite), x: -30, y: -30, width: 60, height: 60, class: 'pix' }) : null,
        isHere ? svg('circle', { r: rad + 4, class: 'map-here' }) : null);
      return g;
    });
    const mapSvg = svg('svg', { class: 'map-svg', viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': `Mapa do ato ${r.act}` },
      svg('g', { class: 'map-rows' }, Array.from({ length: R.ROWS }, (_, i) => svg('line', { x1: 20, x2: VW - 20, y1: VH - 60 - i * 108, y2: VH - 60 - i * 108, class: 'map-row' }))),
      edges, nodeEls);

    mount(frame, head(`Mapa · ato ${r.act}`),
      h('div', { class: 'map-grid' },
        h('div', { class: 'map-scroll' }, mapSvg),
        h('aside', { class: 'map-side' },
          h('section', {},
            h('h3', {}, 'Chefe do ato'),
            h('div', { class: 'map-boss' }, portrait(boss.sprite, 2), h('div', {}, h('b', {}, boss.name), h('p', {}, boss.alias), h('p', { class: 'map-topic' }, boss.topic), h('p', {}, nodeChips(boss.nodes))))),
          h('section', {},
            h('h3', {}, 'Ficha desta operação'),
            sheet(r.attrs, { compact: true }),
            h('p', { class: 'panel-note' }, r.hops ? `${r.hops} salto(s) lateral(is) neste ato: nós tracejados no mapa.` : 'Saltos laterais no mapa vêm do patamar 2 de Redes.')),
          h('section', {},
            h('h3', {}, 'Legenda'),
            h('ul', { class: 'map-legend' }, ['combat', 'elite', 'event', 'rest', 'shop', 'treasure'].map((t) => h('li', {}, h('img', { src: iconURLFor(typeIcon[t], typeColor[t]), class: 'pix-icon', alt: '' }), h('b', {}, R.NODE_TYPES[t].name), h('span', {}, R.NODE_TYPES[t].desc))))),
          r.relics.length ? h('section', {},
            h('h3', {}, 'Ferramentas'),
            h('ul', { class: 'relic-list' }, r.relics.map((id) => { const rel = data.relics.get(id); return rel ? h('li', {}, relicChip(rel), h('span', {}, rel.text)) : null; }))) : null,
          h('p', { class: 'map-hint' }, can.size ? 'Escolha o próximo nó no mapa. Só dá para seguir pelos caminhos ligados, ou saltar para o lado se tiver saltos.' : ''))));
    const here = frame.querySelector('.map-node.is-can');
    const scroller = frame.querySelector('.map-scroll');
    if (scroller) {
      const target = frame.querySelector('.map-node.is-here') || here;
      requestAnimationFrame(() => {
        if (!target) { scroller.scrollTop = scroller.scrollHeight; return; }
        const box = target.getBoundingClientRect(); const sb = scroller.getBoundingClientRect();
        scroller.scrollTop += box.top - sb.top - sb.height * 0.6;
      });
    }
  }

  function go(id) {
    sfx.select();
    R.enterNode(run(), id, data);
    local = {};
    persist();
    render();
  }

  // ----- combate -----

  function renderIntro() {
    const r = run();
    const enc = r.pending.enc;
    const best = store.get().bestiary || {};
    const first = !best[enc.id]?.met;
    const kindLabel = { combat: 'Incidente', elite: 'Elite', boss: 'Chefe' }[enc.kind];
    const moves = enc.intents.map((it) => intentLine(it, data.techniques));
    mount(frame, head(kindLabel), h('div', { class: 'inc-brief' },
      h('div', { class: 'brief-art' },
        h('div', { class: 'brief-portrait' }, portrait(enc.sprite, enc.kind === 'boss' ? 3 : 4)),
        h('p', { class: 'brief-name' }, enc.name),
        h('p', { class: 'brief-alias' }, enc.alias),
        h('dl', { class: 'brief-facts' },
          h('dt', {}, 'vida'), h('dd', {}, String(enc.hp)),
          h('dt', {}, 'tema'), h('dd', {}, enc.topic),
          enc.kind === 'boss' ? [h('dt', {}, 'casos'), h('dd', {}, enc.phases.map((ph) => `${Math.round(ph.at * 100)}%`).join(' e '))] : null)),
      h('div', { class: 'brief-body' },
        h('p', { class: 'step-n' }, `${kindLabel.toLowerCase()}${first ? ' · primeiro encontro' : ''}`),
        local.fightNote ? h('p', { class: 'panel-note is-warn' }, local.fightNote) : null,
        h('h2', { class: 'step-title', tabindex: '-1' }, enc.kind === 'boss' ? enc.title : enc.topic),
        h('p', { class: 'step-text' }, enc.kind === 'boss' ? enc.briefing : enc.flavor),
        h('p', { class: 'brief-topic' }, 'As cartas vêm de: ', nodeChips(enc.nodes)),
        enc.affixes?.length ? h('div', { class: 'brief-affixes' }, h('h3', { class: 'brief-h' }, 'Mutadores'), h('ul', {}, enc.affixes.map((id) => {
          const a = data.affixes.get(id);
          return h('li', {}, icon(a.icon, P.A, 'pix-icon is-sm'), h('b', {}, a.name), ' ', h('span', {}, a.text));
        }))) : null,
        h('h3', { class: 'brief-h' }, 'Repertório'),
        h('ul', { class: 'brief-moves' }, moves.map((m) => h('li', {},
          icon(INTENT_TYPES[m.type].icon, m.type === 'attack' || m.type === 'debuff' ? P.R : m.type === 'block' ? P.W : P.A, 'pix-icon is-sm'),
          h('b', {}, m.name), m.tech ? h('em', {}, m.tech.attack) : null, h('span', {}, m.text)))),
        enc.style ? h('p', { class: 'panel-note' }, enc.style) : null,
        enc.kind === 'boss' ? h('p', { class: 'panel-note is-warn' }, 'Em cada marca de vida o chefe interrompe com uma questão de caso. Acertou: ele fica atordoado e leva dano. Errou: ganha fúria até o fim da luta.') : null,
        h('div', { class: 'exam-actions' },
          h('button', { class: 'btn btn-primary', onclick: startBattle }, enc.kind === 'boss' ? 'Enfrentar' : 'Atender')))));
    frame.querySelector('.step-title')?.focus();
  }

  function startBattle() {
    const r = run();
    const enc = r.pending.enc;
    store.update((s) => { const bb = (s.bestiary ||= {}); (bb[enc.id] ||= { met: 0, beaten: 0 }).met++; });
    sfx.select();
    const b = R.startBattle(r, data);
    battle = { b };
    const kindLabel = { combat: 'Incidente', elite: 'Elite', boss: 'Chefe' }[enc.kind];
    battle.view = mountBattle(frame, {
      enc, b,
      head: () => head(`${kindLabel}: ${enc.name}`),
      onEnd: (bb) => endBattle(bb),
    });
  }

  function endBattle(b) {
    const r = run();
    const enc = r.pending.enc;
    const res = R.finishBattle(r, b, data);
    store.update((s) => {
      s.rust ||= {};
      for (const n of b.rustAdded) s.rust[n] = Date.now();
      for (const n of b.rustCleared) delete s.rust[n];
      for (const a of b.answers) s.history.push({ q: a.id, ok: a.ok, t: Date.now(), kind: a.kind });
      if (s.history.length > 2000) s.history.splice(0, s.history.length - 2000);
      if (res.won) (s.bestiary[enc.id] ||= { met: 1, beaten: 0 }).beaten++;
    });
    local.lastBattle = b;
    battle = null;
    if (res.won) log(`[ok] ${enc.name} contido · ${b.stats.correct}/${b.stats.cards} cartas`, 'ok');
    else log(`[falha] ${enc.name}: integridade zerada`, 'alert');
    persist();
    render();
  }

  // ----- recompensa -----

  function renderReward() {
    const r = run();
    const p = r.pending;
    const res = p.result;
    const rw = p.rewards;
    const b = local.lastBattle;
    local.take ||= new Set(rw.items.filter((i) => i.type === 'script').map((i) => i.id));
    const won = res.won;
    const enc = b?.enc || p.enc;
    const lines = [];
    if (rw.credits) lines.push(h('li', {}, icon('coin', P.A, 'pix-icon is-sm'), `${Math.round(rw.credits * (1 + (R.relicMods(r, data).creditMul || 0)))} créditos`));
    for (const it of rw.items) {
      if (it.type === 'relic') { const rel = data.relics.get(it.id); lines.push(h('li', {}, relicChip(rel), h('span', { class: 'rw-desc' }, rel.text))); }
      if (it.type === 'script') {
        const sc = data.scripts.get(it.id);
        const room = r.scripts.length < R.scriptSlots(r, data);
        lines.push(h('li', {}, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: local.take.has(it.id) && room, disabled: !room, onchange: (e) => { if (e.target.checked) local.take.add(it.id); else local.take.delete(it.id); } }),
          h('span', {}, icon(sc.icon, P.A, 'pix-icon is-sm'), ' script ', h('b', {}, sc.name), ` · ${sc.text}`, room ? '' : ' (sem vaga)'))));
      }
    }
    const choice = rw.relicChoice.length ? h('div', { class: 'relic-choice' }, rw.relicChoice.map((id) => {
      const rel = data.relics.get(id);
      return h('button', { class: `relic-card is-${rel.rarity}${local.choice === id ? ' is-on' : ''}`, onclick: () => { local.choice = id; sfx.click(); renderReward(); } },
        icon(rel.icon, rel.rarity === 'chefe' ? P.R : P.A, 'pix-icon is-big'), h('b', {}, rel.name), h('span', {}, rel.text), h('em', {}, rel.rarity));
    })) : null;
    const stats = b ? h('dl', { class: 'end-stats' },
      h('dt', {}, 'cartas'), h('dd', {}, `${b.stats.correct}/${b.stats.cards}`),
      h('dt', {}, 'rápidas'), h('dd', {}, String(b.stats.fast)),
      h('dt', {}, 'críticos'), h('dd', {}, String(b.stats.crits)),
      h('dt', {}, 'foco máx.'), h('dd', {}, String(b.stats.maxFocus)),
      h('dt', {}, 'dano recebido'), h('dd', {}, String(b.stats.dmgTaken)),
      h('dt', {}, 'turnos'), h('dd', {}, String(b.turn)),
      h('dt', {}, 'integridade'), h('dd', {}, `${r.hp}/${r.maxHp}`),
      h('dt', {}, 'tema'), h('dd', {}, enc?.topic || '')) : null;
    const mistakes = b ? b.answers.filter((x) => !x.ok).length : 0;
    mount(frame, head('Ameaça contida'), body(
      h('div', { class: 'verdict is-pass' },
        h('p', { class: 'verdict-word', tabindex: '-1', 'data-text': 'contido' }, 'contido'),
        h('p', { class: 'verdict-score' }, `${enc?.name || 'O atacante'} foi expulso da rede.`, res.notes?.length ? ` ${res.notes.map((n) => n.text).join(' · ')}.` : '')),
      stats,
      b ? h('details', { class: 'rw-review', open: mistakes ? '' : null }, h('summary', {}, mistakes ? `Revisar ${mistakes} erro(s) · elas voltam como revisão nos próximos combates` : `Relatório do combate · ${b.answers.length} carta(s), nenhum erro`), answersReview(b, { onlyWrong: mistakes > 0 })) : null,
      won ? [h('h2', { class: 'rev-title' }, 'Recompensas'), h('ul', { class: 'rw-list' }, lines), choice ? [h('p', { class: 'step-text' }, 'Escolha uma ferramenta:'), choice] : null] : null,
      h('div', { class: 'exam-actions' },
        h('button', { class: 'btn btn-primary', disabled: !!choice && !local.choice, onclick: claim }, p.kind === 'boss' && won ? (r.act >= R.ACTS ? 'Encerrar a operação' : 'Seguir para o próximo ato') : 'Voltar ao mapa'))));
    frame.querySelector('.verdict-word')?.focus();
  }

  function claim() {
    const r = run();
    const notes = R.claimRewards(r, data, { take: [...(local.take || [])], relicChoice: local.choice || null });
    if (notes?.length) for (const n of notes) if (n.kind === 'relic') log(n.text, 'ok');
    local = {};
    persist();
    sfx.select();
    render();
  }

  // ----- transição de ato -----

  function renderAct() {
    const r = run();
    const boss = data.bosses.find((b) => b.id === r.bosses[r.act]);
    const notes = r.pending.notes || [];
    mount(frame, head(`Ato ${r.act}`), body(
      h('p', { class: 'exam-kicker' }, 'novo ato'),
      h('h1', { class: 'exam-title' }, `Ato ${r.act} · ${R.ACT_NAMES[r.act]}`),
      h('p', { class: 'exam-sub' }, 'Você descansou entre os atos. ', notes.filter((n) => n.kind === 'hp').map((n) => n.text).join(' '), '.'),
      h('div', { class: 'map-boss is-big' }, portrait(boss.sprite, 3), h('div', {}, h('p', { class: 'step-n' }, 'chefe deste ato'), h('b', {}, boss.name), h('p', {}, boss.alias), h('p', { class: 'map-topic' }, boss.topic), h('p', {}, nodeChips(boss.nodes)))),
      h('p', { class: 'step-text' }, 'Os atacantes deste ato são mais resistentes e causam mais dano. As cartas que você errou continuam voltando como revisão.'),
      r.attrs.hops ? h('p', { class: 'panel-note' }, `Seus saltos laterais foram recarregados: ${r.hops}.`) : null,
      h('div', { class: 'exam-actions' },
        h('button', { class: 'btn btn-primary', onclick: () => { R.continueToMap(r); persist(); render(); } }, 'Abrir o mapa'))));
  }

  // ----- imprevisto -----

  function questionBlock(q, onAnswer) {
    const answered = local.answer != null;
    return h('div', { class: 'quiz' },
      h('p', { class: 'quiz-src' }, `questão de ${nodeName(q.node)} · ${LEVELS[q.level].name.toLowerCase()}`),
      h('p', { class: 'q-prompt' }, q.prompt),
      q.context ? h('pre', { class: 'q-context' }, q.context) : null,
      h('ul', { class: 'opts' }, q.options.map((o, i) => h('li', {}, h('button', {
        class: `opt${answered && i === q.answer ? ' is-right' : ''}${answered && i === local.answer && i !== q.answer ? ' is-wrong' : ''}`,
        disabled: answered,
        onclick: () => { local.answer = i; onAnswer(i === q.answer); },
      }, h('span', { class: 'opt-key' }, 'ABCD'[i]), h('span', { class: 'opt-text' }, o))))),
      answered ? h('div', { class: `fb ${local.answer === q.answer ? 'is-good' : 'is-bad'}` }, h('p', { class: 'fb-head' }, h('b', {}, local.answer === q.answer ? 'resposta certa' : 'resposta errada')), h('p', {}, q.explain)) : null);
  }

  function notesList(notes = []) {
    return notes.length ? h('ul', { class: 'notes' }, notes.map((n) => h('li', { class: `is-${n.kind}` }, n.text))) : null;
  }

  function renderEvent() {
    const r = run();
    const p = r.pending;
    const ev = data.events.find((e) => e.id === p.eventId);
    const res = p.result;
    let content2;
    if (res) {
      content2 = [
        res.quiz?.question ? questionBlock(res.quiz.question, () => {}) : null,
        h('div', { class: 'ev-result' }, h('p', {}, res.text), notesList(res.notes)),
        h('div', { class: 'exam-actions' },
          r.status === 'dead' ? h('button', { class: 'btn btn-primary', onclick: render }, 'Ver relatório')
            : h('button', { class: 'btn btn-primary', onclick: () => { R.continueToMap(r); persist(); local = {}; render(); } }, 'Voltar ao mapa')),
      ];
    } else if (p.quiz) {
      content2 = [questionBlock(p.quiz.question, (ok) => {
        ok ? sfx.right() : sfx.wrong();
        const out = R.answerEventQuiz(r, data, ok);
        persist();
        if (out?.fight && r.status === 'battle') { local.fightNote = out.text; render(); return; }
        renderEvent();
      })];
    } else {
      content2 = h('ul', { class: 'choices' }, ev.choices.map((c, i) => {
        const req = R.requirementMet(r, data, c.requires);
        return h('li', {}, h('button', { class: `choice${req.ok ? '' : ' is-locked'}`, disabled: !req.ok, onclick: () => pickChoice(i) },
          h('span', { class: 'choice-label' }, c.label),
          c.quiz ? h('span', { class: 'choice-lock is-quiz' }, 'teste de conhecimento') : null,
          !req.ok ? h('span', { class: 'choice-lock' }, req.reason) : c.requires?.node ? h('span', { class: 'choice-lock is-ok' }, `usa ${nodeName(c.requires.node)}`) : null));
      }));
    }
    mount(frame, head('Imprevisto'), body(
      h('p', { class: 'exam-kicker' }, `imprevisto · ${ev.topic}`),
      h('h1', { class: 'exam-title ev-title' }, icon(ev.icon, P.W, 'pix-icon is-big'), ev.title),
      ev.text.map((t) => h('p', { class: 'step-text' }, t)),
      content2));
  }

  function pickChoice(i) {
    const r = run();
    const res = R.chooseEvent(r, data, i);
    sfx.select();
    persist();
    if (res?.fight && r.status === 'battle') { local.fightNote = res.text; render(); return; }
    renderEvent();
  }

  // ----- plantão -----

  // nós dos flashcards que você errou nesta operação (mais erros primeiro)
  function studyNodes(r) {
    const count = {};
    for (const [id, n] of Object.entries(r.stats.misses || {})) {
      const node = content.run.cards.find((c) => c.id === id)?.node || data.techniques.get(id)?.node;
      if (node) count[node] = (count[node] || 0) + n;
    }
    return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 4);
  }

  function renderRest() {
    const r = run();
    const p = r.pending;
    const heal = Math.round(r.maxHp * 0.28);
    let main;
    if (p.done) {
      main = [
        local.question ? questionBlock(local.question, () => {}) : null,
        h('div', { class: 'ev-result' }, notesList(p.result?.notes)),
        h('div', { class: 'exam-actions' },
          h('button', { class: 'btn btn-primary', onclick: () => { R.continueToMap(r); persist(); local = {}; render(); } }, 'Voltar ao mapa')),
      ];
    } else if (local.question) {
      main = [questionBlock(local.question, (ok) => {
        ok ? sfx.right() : sfx.wrong();
        R.restStudy(r, data, ok, local.question);
        persist();
        renderRest();
      })];
    } else {
      main = h('ul', { class: 'rest-opts' },
        h('li', {}, h('button', { class: 'rest-card', onclick: () => { R.restSleep(r); sfx.heal(); persist(); renderRest(); } },
          icon('cup', P.G, 'pix-icon is-big'), h('b', {}, 'Dormir'), h('span', {}, `Recupera ${heal} de integridade (${r.hp}/${r.maxHp} agora).`))),
        h('li', {}, h('button', { class: 'rest-card', onclick: () => { local.question = R.pickQuestion(r, data, studyNodes(r)); persist(); renderRest(); } },
          icon('doc', P.A, 'pix-icon is-big'), h('b', {}, 'Estudar'), h('span', {}, 'Uma questão real do banco de provas, puxada dos temas que você mais errou. Acertar dá +6 de integridade máxima, cura 10 e limpa uma ferrugem.'))));
    }
    mount(frame, head('Plantão'), body(
      h('p', { class: 'exam-kicker' }, 'plantão'),
      h('h1', { class: 'exam-title' }, 'Plantão'),
      h('p', { class: 'exam-sub' }, 'Um respiro entre incidentes. Escolha uma coisa para fazer.'),
      main));
  }

  // ----- mercado -----

  function renderShop() {
    const r = run();
    const p = r.pending;
    const card = (it) => {
      const sold = p.bought.includes(it.id);
      let title, text, ic, color = P.G;
      if (it.type === 'relic') { const rel = data.relics.get(it.id); title = rel.name; text = rel.text; ic = rel.icon; color = rel.rarity === 'rara' ? P.A : P.G; }
      if (it.type === 'script') { const sc = data.scripts.get(it.id); title = `script: ${sc.name}`; text = sc.text; ic = sc.icon; color = P.A; }
      if (it.type === 'heal') { title = 'Manutenção'; text = `+${it.amount} de integridade.`; ic = 'heart'; }
      if (it.type === 'unrust') { title = 'Reciclagem'; text = 'Remove a ferrugem de um nó.'; ic = 'chain'; }
      const afford = r.credits >= it.price;
      return h('li', {}, h('button', {
        class: `shop-item${sold ? ' is-sold' : ''}${afford ? '' : ' is-poor'}`, disabled: sold,
        onclick: () => {
          const res = R.buy(r, data, it.id);
          if (!res.ok) { sfx.wrong(); local.msg = res.reason; local.msgBad = true; } else { sfx.select(); local.msg = res.notes.map((n) => n.text).join(' '); local.msgBad = false; persist(); }
          renderShop();
        },
      }, icon(ic, color, 'pix-icon is-big'), h('b', {}, title), h('span', {}, text), h('em', {}, sold ? 'vendido' : `${it.price} créditos`)));
    };
    mount(frame, head('Mercado'), body(
      h('p', { class: 'exam-kicker' }, 'mercado do SOC'),
      h('h1', { class: 'exam-title' }, 'Mercado'),
      h('p', { class: 'exam-sub' }, `Você tem `, h('b', {}, `${r.credits} créditos`), '.'),
      local.msg ? h('p', { class: `panel-note ${local.msgBad ? 'is-warn' : 'is-ok'}`, role: 'status' }, local.msg) : null,
      h('h2', { class: 'rev-title' }, 'Ferramentas'),
      h('ul', { class: 'shop-grid' }, p.stock.filter((x) => x.type === 'relic').map(card)),
      h('h2', { class: 'rev-title' }, 'Scripts'),
      h('ul', { class: 'shop-grid' }, p.stock.filter((x) => x.type === 'script').map(card)),
      h('h2', { class: 'rev-title' }, 'Serviços'),
      h('ul', { class: 'shop-grid' }, p.stock.filter((x) => x.type === 'heal' || x.type === 'unrust').map(card)),
      h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', onclick: () => { R.continueToMap(r); persist(); local = {}; render(); } }, 'Sair do mercado'))));
  }

  // ----- achado -----

  function renderTreasure() {
    const r = run();
    mount(frame, head('Achado'), body(
      h('p', { class: 'exam-kicker' }, 'achado'),
      h('h1', { class: 'exam-title ev-title' }, icon('chest', P.A, 'pix-icon is-big'), 'Achado no data center'),
      h('p', { class: 'step-text' }, 'Num rack esquecido, alguém deixou equipamento que ainda funciona.'),
      notesList(r.pending.notes),
      h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', onclick: () => { R.continueToMap(r); persist(); render(); } }, 'Voltar ao mapa'))));
  }

  // ----- fim -----

  function renderEnd() {
    const r = run();
    const fin = finalizeRun(r);
    persist();
    const sum = R.summary(r);
    const won = r.status === 'won';
    const misses = Object.entries(r.stats.misses).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => {
      const c = content.run.cards.find((x) => x.id === id);
      if (c) return { n, kind: 'flashcard', node: c.node, title: c.q, answer: c.a[0], why: c.why };
      const t = data.techniques.get(id);
      if (t) return { n, kind: 'análise de log', node: t.node, title: `${t.name} · ${t.attack}`, answer: t.tell, why: t.explain };
      return null;
    }).filter(Boolean);
    const gains = Object.entries(r.areaXp || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    mount(frame, head(won ? 'Operação concluída' : 'Operação encerrada'), body(
      h('div', { class: `verdict ${won ? 'is-pass' : 'is-fail'}` },
        h('p', { class: 'verdict-word', tabindex: '-1', 'data-text': won ? 'vitória' : 'derrota' }, won ? 'vitória' : 'derrota'),
        h('p', { class: 'verdict-score' }, won ? 'Os três chefes foram contidos.' : `${r.deathBy ? `Derrubado por ${r.deathBy}` : 'A operação terminou'} no ato ${r.act}, andar ${r.floor}.`),
        h('p', { class: 'verdict-note' }, `+${fin.xp} XP`, fin.unlocked != null ? ` · ameaça ${fin.unlocked} liberada: ${R.THREATS[fin.unlocked].name}` : '')),
      fin.tierUps?.length ? h('div', { class: 'tierups' }, fin.tierUps.map((t) => h('p', {}, icon(t.attr.icon, P.G, 'pix-icon'), h('b', {}, `${t.attr.name} subiu para o patamar ${t.tier}`), ` · agora ${t.attr.fmt(t.value)}`))) : null,
      h('dl', { class: 'end-stats' },
        h('dt', {}, 'cartas'), h('dd', {}, `${r.stats.correct}/${r.stats.cards} (${Math.round(sum.acc * 100)}%)`),
        h('dt', {}, 'logs'), h('dd', {}, `${r.stats.logsOk}/${r.stats.logs}`),
        h('dt', {}, 'casos'), h('dd', {}, `${r.stats.casesOk}/${r.stats.cases}`),
        h('dt', {}, 'incidentes'), h('dd', {}, String(r.stats.fights)),
        h('dt', {}, 'elites'), h('dd', {}, String(r.stats.elites)),
        h('dt', {}, 'chefes'), h('dd', {}, String(r.stats.bosses)),
        h('dt', {}, 'críticos'), h('dd', {}, String(r.stats.crits)),
        h('dt', {}, 'foco máx.'), h('dd', {}, String(r.stats.maxFocus)),
        h('dt', {}, 'ferramentas'), h('dd', {}, String(r.relics.length))),
      gains.length ? [h('h2', { class: 'rev-title' }, 'XP de área ganho'), h('p', { class: 'step-text' }, 'Somado à sua ficha do analista. Vale para a próxima operação.'),
        h('ul', { class: 'gains' }, gains.map(([br, v]) => h('li', {}, h('span', {}, branchName(br)), h('b', {}, `+${v}`))))] : null,
      h('h2', { class: 'rev-title' }, 'Desempenho por tema'),
      h('p', { class: 'step-text' }, 'Do pior para o melhor. É aqui que está o seu próximo estudo.'),
      h('ul', { class: 'topics' }, sum.topics.map((t) => h('li', {},
        h('span', { class: 'topic-name' }, t.name),
        h('span', { class: 'topic-bar' }, h('span', { class: t.acc < 0.6 ? 'is-low' : '', style: { width: `${Math.round(t.acc * 100)}%` } })),
        h('span', { class: 'topic-num' }, `${t.ok}/${t.total}`),
        h('span', { class: 'topic-nodes' }, (t.nodes || []).map((n) => content.nodes.get(n) ? h('button', { class: `link-btn is-${nodeStatus(content.nodes.get(n)).key}`, onclick: () => { close(); onNode?.(n); } }, content.nodes.get(n).code) : null))))),
      local.lastBattle && !won ? h('details', { class: 'rw-review' }, h('summary', {}, 'Cartas do último combate'), answersReview(local.lastBattle)) : null,
      misses.length ? [h('h2', { class: 'rev-title' }, 'O que mais te pegou'), h('ul', { class: 'review' }, misses.map((m) => h('li', { class: 'rev is-bad' },
        h('div', { class: 'rev-head' }, h('span', {}, `${m.n} erro(s)`), h('span', {}, m.kind), m.node ? h('span', {}, nodeName(m.node)) : null),
        h('p', { class: 'rev-prompt' }, h('b', {}, m.title)),
        h('p', { class: 'rev-ans is-ok' }, m.kind === 'flashcard' ? `Resposta: ${m.answer}` : `O sinal: ${m.answer}`),
        h('p', { class: 'rev-explain' }, m.why))))] : null,
      h('div', { class: 'exam-actions' },
        h('button', { class: 'btn btn-primary', onclick: () => { store.update((s) => { s.run = null; }); close(); location.hash = '#/operacao'; } }, 'Voltar à base'))));
    frame.querySelector('.verdict-word')?.focus();
  }

  render();
}

// ---------- utilitários de imagem para o SVG do mapa ----------

const portraitCache = new Map();
function iconURLFor(name, color) { return iconURL(name, color); }
function portraitURL(kind) {
  if (!portraitCache.has(kind)) portraitCache.set(kind, portrait(kind, 2).toDataURL());
  return portraitCache.get(kind);
}
