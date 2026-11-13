// Tela de combate da 0.4 (cartas de conhecimento) e utilitários visuais compartilhados com a operação.
//
// Layout: palco em pixel art com a intenção do inimigo por cima, barra de ações embaixo e, ao lado,
// o painel da carta (pergunta, cronômetro, alternativas e explicação) seguido do registro.

import { h, mount, prefersReducedMotion } from './dom.js';
import { content } from '../content.js';
import {
  ACTIONS, STATUS, INTENT_TYPES, FOCUS_MAX, FOCUS_STEP, FAST, EXPOSE_MUL,
  canAct, openCard, openCase, answerCard, endTurn, canEndTurn, useScript, canUseScript, intentView, actionCost,
} from '../battle.js';
import { createScene, enemyLayers } from './battle-scene.js';
import { PALETTE as P, SPRITES, sprite, iconURL } from './pixel.js';
import { sfx } from './sfx.js';
import * as store from '../state.js';

export const nodeName = (id) => content.nodes.get(id)?.short || id;

// Retrato do inimigo num canvas ampliado.
export function portrait(kind, scale = 3) {
  const layers = enemyLayers(kind);
  let w = 0, hgt = 0;
  for (const [name, dx, dy] of layers) {
    const rows = SPRITES[name];
    w = Math.max(w, dx + rows[0].length);
    hgt = Math.max(hgt, dy + rows.length);
  }
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = hgt * scale;
  c.className = 'pix';
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const [name, dx, dy] of layers) {
    const img = sprite(name);
    ctx.drawImage(img, dx * scale, dy * scale, img.width * scale, img.height * scale);
  }
  return c;
}

export function icon(name, color = P.G, cls = 'pix-icon') {
  return h('img', { class: cls, src: iconURL(name, color), alt: '', width: '18', height: '18', 'aria-hidden': 'true' });
}

export function pips(n, max, cls = '') {
  return h('span', { class: `pips ${cls}`, 'aria-label': `${n} de ${max}` },
    Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'is-on' : '' })));
}

// Texto curto de uma intenção ("12 × 2", "+10 bloqueio", "+3 força").
export function intentSummary(iv) {
  if (!iv) return '';
  if (iv.hidden) return '?';
  const parts = [];
  if (iv.dmg) parts.push(iv.hits > 1 ? `${iv.dmg}×${iv.hits}` : String(iv.dmg));
  if (iv.block) parts.push(`+${iv.block} bloq`);
  if (iv.str) parts.push(`+${iv.str} força`);
  if (iv.heal) parts.push(`+${iv.heal} vida`);
  if (iv.status) parts.push(STATUS[iv.status]?.name.toLowerCase());
  return parts.join(' · ');
}

// Intenção crua do JSON (sem estado de combate), para o briefing e o bestiário.
export function intentLine(it, techniques) {
  const tech = it.tech ? techniques.get(it.tech) : null;
  const iv = { dmg: it.dmg || 0, hits: it.hits || 1, block: it.block || 0, str: it.str || 0, heal: it.heal || 0, status: it.status || null };
  return { type: it.type, name: it.name || tech?.name || INTENT_TYPES[it.type].name, tech, text: intentSummary(iv) };
}

const KIND_LABEL = { flash: 'flashcard', log: 'análise de log', case: 'questão de caso' };

// ---------- Combate ----------

// Monta o combate dentro de `frame`. `head()` devolve o cabeçalho; `onEnd(b)` é chamado quando o combate acaba.
export function mountBattle(frame, { enc, b, head, onEnd }) {
  let scene = null;
  let busy = false;
  let ended = false;
  let timer = null;        // { raf, start, elapsed, total, last }
  let last = null;         // resultado da última carta, mostrado no painel até a próxima
  const ui = {};

  function build() {
    ui.canvas = h('canvas', { class: 'inc-canvas pix', width: '256', height: '144', 'aria-hidden': 'true' });
    ui.foe = h('div', { class: 'hud hud-foe' });
    ui.you = h('div', { class: 'hud hud-you' });
    ui.intent = h('div', { class: 'intent', 'aria-live': 'polite' });
    ui.stage = h('div', { class: 'inc-stage' }, ui.canvas, ui.intent, ui.foe, ui.you);
    ui.actions = h('div', { class: 'inc-actions' });
    ui.card = h('section', { class: 'cardp', 'aria-live': 'polite' });
    ui.feed = h('ol', { class: 'feed', 'aria-live': 'polite' });
    ui.side = h('aside', { class: 'inc-side', 'aria-label': 'Carta e registro' }, ui.card, h('section', { class: 'feed-wrap' }, h('h3', {}, 'Registro'), ui.feed));
    ui.main = h('div', { class: 'inc-main' }, ui.stage, ui.actions);
    ui.grid = h('div', { class: 'inc-grid' }, ui.main, ui.side);
    mount(frame, head(), ui.grid);
    scene = createScene(ui.canvas, { enemy: enc.sprite, avatar: store.get().avatar });
    syncScene();
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function destroy() {
    stopTimer();
    scene?.destroy();
    scene = null;
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function syncScene() {
    if (!scene) return;
    scene.set({
      vis: 80,
      integrity: b.hp / b.maxHp,
      presence: b.foe.hp / b.foe.maxHp,
      exposed: b.foe.exposto > 0,
      enraged: b.foe.rage > 0 || b.phases.some((p) => p.hit),
      elite: enc.kind === 'elite',
      blind: b.you.ruido > 0,
      shields: Math.min(2, b.block / 6),
      posture: false,
      foeBlock: b.foe.block > 0,
      stunned: b.foe.atordoado > 0,
    });
  }

  function bar(value, max, cls, label) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return h('div', { class: `hbar ${cls}`, role: 'meter', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(Math.round(value)) },
      h('span', { class: 'hbar-fill', style: { width: `${pct}%` } }), h('span', { class: 'hbar-ghost', style: { width: `${pct}%` } }));
  }

  function chip(text, kind, ic, title, color) {
    return h('span', { class: `st-chip is-${kind}`, title }, ic ? icon(ic, color, 'pix-icon is-sm') : null, text);
  }

  // ----- HUD -----

  function renderHud() {
    const kindLabel = enc.kind === 'boss' ? 'chefe' : enc.kind === 'elite' ? 'elite' : null;
    const f = b.foe;
    const foeChips = [];
    if (f.block) foeChips.push(chip(`${f.block}`, 'block', 'shield', `Bloqueio: absorve ${f.block} de dano até o próximo turno dele`, P.W));
    if (f.str) foeChips.push(chip(`+${f.str} força`, 'bad', 'bolt', `Cada golpe causa +${f.str}`, P.R));
    if (f.rage) foeChips.push(chip(`fúria +${Math.round(f.rage * 100)}%`, 'bad', 'bolt', 'Questão de caso errada: dano maior até o fim do combate', P.R));
    if (f.exposto) foeChips.push(chip(`exposto ${f.exposto}t`, 'good', 'target', STATUS.exposto.desc, P.G));
    if (f.atordoado) foeChips.push(chip('atordoado', 'good', 'chain', STATUS.atordoado.desc, P.G));
    for (const id of enc.affixes || []) {
      const a = b.ctx.affixes?.get(id);
      if (a) foeChips.push(chip(a.name, 'affix', a.icon, a.text, P.A));
    }
    mount(ui.foe,
      h('div', { class: 'hud-name' }, h('b', {}, enc.name), kindLabel ? h('em', { class: `hud-kind is-${enc.kind}` }, kindLabel) : null, h('span', {}, enc.alias)),
      h('div', { class: 'hud-row' }, h('span', { class: 'hud-k' }, 'vida'), bar(f.hp, f.maxHp, 'is-foe', 'Vida do inimigo'), h('span', { class: 'hud-v' }, `${f.hp}`)),
      enc.kind === 'boss' ? h('div', { class: 'hud-phases' }, b.phases.map((p) => h('i', { class: `ph${p.hit ? ' is-hit' : ''}`, style: { left: `${p.at * 100}%` }, title: `Questão de caso em ${Math.round(p.at * 100)}% da vida` }))) : null,
      h('div', { class: 'st-row' }, foeChips));

    const youChips = [];
    for (const [k, v] of Object.entries(b.you)) {
      if (!v) continue;
      const S = STATUS[k];
      youChips.push(chip(`${S.name}${v > 1 ? ` ${v}t` : ''}`, 'bad', S.icon, S.desc, P.R));
    }
    if (b.autoNegate) youChips.push(chip('honeypot', 'good', 'target', 'O próximo ataque do inimigo será anulado', P.G));
    if (b.wrongFree) youChips.push(chip('pato', 'good', 'doc', 'A próxima resposta errada pode ser refeita', P.G));
    if (b.cardCut) youChips.push(chip(`−${b.cardCut} opções`, 'good', 'doc', 'A próxima carta vem com alternativas erradas descartadas', P.G));
    const low = b.hp < b.maxHp * 0.35;
    mount(ui.you,
      h('div', { class: 'hud-name' }, h('b', {}, 'SOC'), h('span', {}, `turno ${b.turn}`)),
      h('div', { class: 'hud-row', title: 'Integridade: chega a zero e a operação termina' },
        h('span', { class: 'hud-k' }, icon('heart', low ? P.R : P.G, 'pix-icon is-sm'), h('span', { class: 'hud-l' }, 'integridade')),
        bar(b.hp, b.maxHp, low ? 'is-low' : 'is-you', 'Integridade'),
        h('span', { class: 'hud-v' }, `${b.hp}`)),
      h('div', { class: 'hud-row', title: 'Banda: pontos de ação deste turno' },
        h('span', { class: 'hud-k' }, icon('bolt', P.A, 'pix-icon is-sm'), h('span', { class: 'hud-l' }, 'banda')),
        pips(b.ap, Math.max(b.maxAp, b.ap), 'is-ap'), h('span', { class: 'hud-v' }, String(b.ap))),
      h('div', { class: 'hud-row', title: `Foco: cada acerto seguido soma +${FOCUS_STEP * 100}% de dano e bloqueio (máx. ${FOCUS_MAX}). Errar zera.` },
        h('span', { class: 'hud-k' }, icon('brain', b.focus ? P.W : P.m, 'pix-icon is-sm'), h('span', { class: 'hud-l' }, 'foco')),
        pips(b.focus, FOCUS_MAX, 'is-focus'), h('span', { class: 'hud-v' }, String(b.focus))),
      h('div', { class: 'st-row' }, b.block ? chip(`${b.block} bloqueio`, 'block', 'shield', `Bloqueio: absorve ${b.block} de dano no próximo turno do inimigo`, P.W) : null, youChips));
  }

  function renderIntent() {
    const iv = intentView(b);
    if (!iv) { mount(ui.intent); return; }
    const T = INTENT_TYPES[iv.type];
    const state = iv.stunned ? 'atordoado' : iv.negated ? 'anulado' : null;
    const color = iv.type === 'attack' || iv.type === 'debuff' ? P.R : iv.type === 'block' ? P.W : P.A;
    ui.intent.className = `intent is-${iv.type}${state ? ' is-off' : ''}`;
    mount(ui.intent,
      h('span', { class: 'intent-k' }, 'próxima ação'),
      h('span', { class: 'intent-main' }, icon(T.icon, state ? P.m : color, 'pix-icon'), h('b', {}, intentSummary(iv) || T.name)),
      h('span', { class: 'intent-name' }, iv.hidden ? 'polimórfico: valor oculto' : iv.name, iv.tech && !iv.hidden ? h('em', {}, iv.tech.attack) : null),
      state ? h('span', { class: 'intent-state' }, state)
        : iv.analyzable ? h('span', { class: 'intent-tip' }, icon('eye', P.G, 'pix-icon is-sm'), 'analisável') : null);
  }

  // ----- ações -----

  function preview(id) {
    const mul = 1 + FOCUS_STEP * b.focus;
    const exp = b.foe.exposto > 0 ? EXPOSE_MUL : 1;
    if (id === 'attack') return `${Math.round(b.attrs.atk * mul * (1 + (b.mods.atkMul || 0)) * exp)} dano`;
    if (id === 'defend') return `+${Math.round(b.attrs.def * mul) + (b.mods.defBonus || 0)} bloq`;
    if (id === 'analyze') {
      const iv = intentView(b);
      const dmg = Math.round(b.attrs.analysis * mul * exp);
      return iv?.tech ? `anula · ${dmg} dano` : `${dmg} dano`;
    }
    return '';
  }

  function renderActions() {
    const list = Object.values(ACTIONS).map((a) => {
      const chk = canAct(b, a.id);
      const cost = actionCost(b, a.id);
      return h('button', {
        class: `act is-${a.id}`,
        disabled: !chk.ok || busy,
        title: `${a.name}: ${a.text}${chk.ok ? '' : ` (${chk.reason})`}`,
        onclick: () => act(a.id),
      },
        h('span', { class: 'act-key', 'aria-hidden': 'true' }, a.key),
        icon(a.icon, chk.ok ? (a.id === 'analyze' ? P.W : P.G) : P.m),
        h('span', { class: 'act-name' }, a.name),
        pips(cost, cost, 'is-cost'),
        h('span', { class: 'act-prev' }, preview(a.id)),
        !chk.ok && chk.reason && !/banda|responda|pendente|encerrado/.test(chk.reason) ? h('span', { class: 'act-why' }, chk.reason) : null);
    });
    const scripts = b.scripts.map((id, i) => {
      const s = b.ctx.scripts.get(id);
      const chk = canUseScript(b, i);
      return h('button', { class: 'scr', disabled: !chk.ok || busy, title: `${s.name}: ${s.text}${chk.ok ? '' : ` (${chk.reason})`}`, onclick: () => runScript(i) },
        icon(s.icon, P.A, 'pix-icon is-sm'), h('span', {}, s.name));
    });
    mount(ui.actions,
      h('div', { class: 'act-list' }, list),
      scripts.length ? h('div', { class: 'scr-row' }, h('span', { class: 'scr-k' }, 'scripts'), scripts, h('span', { class: 'scr-hint' }, 'grátis · somem ao usar')) : null,
      h('div', { class: 'act-end' },
        h('p', { class: 'act-hint' }, b.card ? 'Responda a carta.' : b.pendingCase ? 'Questão de caso do chefe.' : b.ap ? `${b.ap} de banda livre${b.mods.carryMax ? ` · guarda até ${b.mods.carryMax}` : ''}` : 'Banda esgotada: encerre o turno.'),
        h('button', { class: 'btn btn-primary btn-end', disabled: busy || !canEndTurn(b), onclick: finish }, 'Encerrar turno', h('kbd', {}, 'E'))));
  }

  // ----- painel da carta -----

  function renderCard() {
    // no celular, a carta aberta e a explicação de um erro ficam no topo
    ui.grid.classList.toggle('has-card', !!b.card || !!(last && !last.ok));
    const c = b.card;
    if (c) return renderOpenCard(c);
    if (last) return renderResult(last);
    renderIdle();
  }

  function renderIdle() {
    const iv = intentView(b);
    const tip = !iv ? '' : iv.stunned ? 'O inimigo está atordoado e perde a próxima ação. Ataque com tudo.'
      : iv.negated ? 'Golpe anulado. O resto da banda pode ir para o ataque.'
        : iv.analyzable && (iv.dmg * iv.hits) >= 8 ? `Golpe grande anunciado: analisar o log anula ${iv.dmg * iv.hits} de dano e ainda contra-ataca.`
          : iv.dmg ? `Golpe anunciado: ${iv.dmg * iv.hits} de dano. Defender gera bloqueio; atacar encerra a luta mais cedo.`
            : 'O inimigo não vai atacar neste turno. Bom momento para atacar.';
    mount(ui.card,
      h('div', { class: 'cardp-head' }, h('span', {}, `turno ${b.turn}`), h('span', { class: 'cardp-kind' }, 'sua vez')),
      h('p', { class: 'cardp-idle' }, 'Escolha uma ação. Cada ação abre uma carta: ', h('b', {}, 'acertou, a ação acontece'), '. Responder na primeira metade do tempo é ', h('b', {}, 'rápido'), ' (crítico no ataque, +50% no bloqueio).'),
      h('p', { class: 'cardp-tip' }, tip),
      enc.style ? h('p', { class: 'cardp-style' }, h('b', {}, 'Leitura do inimigo: '), enc.style) : null,
      h('p', { class: 'cardp-keys' }, h('kbd', {}, '1'), ' atacar  ', h('kbd', {}, '2'), ' defender  ', h('kbd', {}, '3'), ' analisar  ', h('kbd', {}, 'E'), ' encerrar'));
  }

  function renderOpenCard(c) {
    const keys = 'ABCD';
    const head = h('div', { class: 'cardp-head' },
      h('span', {}, c.kind === 'case' ? 'interrupção do chefe' : ACTIONS[c.action]?.name.toLowerCase()),
      h('span', { class: `cardp-kind is-${c.kind}` }, KIND_LABEL[c.kind]),
      c.node ? h('span', { class: 'cardp-node' }, nodeName(c.node)) : null,
      c.review ? h('span', { class: 'cardp-review', title: 'Você errou esta carta antes nesta operação' }, 'revisão') : null);
    ui.timerFill = h('span', { class: 'tmr-fill' });
    ui.timerText = h('span', { class: 'tmr-text' });
    const tmr = h('div', { class: 'tmr' }, h('span', { class: 'tmr-fast', style: { width: `${FAST * 100}%` }, title: 'Zona rápida' }), ui.timerFill, ui.timerText);
    mount(ui.card,
      head, tmr,
      c.kind === 'case' && c.phase?.text ? h('p', { class: 'cardp-phase' }, c.phase.text) : null,
      c.kind === 'log' ? h('p', { class: 'ev-src' }, icon('eye', P.G, 'pix-icon is-sm'), c.source) : null,
      c.kind === 'log' ? h('pre', { class: 'q-context ev-pre' }, c.evidence) : null,
      h('p', { class: `cardp-q${c.kind === 'flash' ? ' is-big' : ''}` }, c.q),
      c.context ? h('pre', { class: 'q-context' }, c.context) : null,
      h('ul', { class: 'cardp-opts' }, c.options.map((o, i) => h('li', {}, h('button', {
        class: `opt${c.cut.includes(i) ? ' is-cut' : ''}`,
        disabled: c.cut.includes(i) || busy,
        onclick: () => choose(i),
      }, h('span', { class: 'opt-key' }, keys[i]), h('span', { class: 'opt-text' }, o, c.optionEn ? h('em', {}, c.optionEn[i]) : null))))),
      c.retried ? h('p', { class: 'cardp-retry' }, 'Pato de borracha: explique para ele e tente de novo. Sem crítico desta vez.') : null);
    ui.card.querySelector('.opt:not([disabled])')?.focus({ preventScroll: true });
  }

  function renderResult(r) {
    const c = r.card;
    const keys = 'ABCD';
    const verdict = r.ok ? (r.fast ? (c.action === 'attack' || c.action === 'analyze' ? 'crítico!' : c.action === 'defend' ? 'rápido · +50%' : 'certo') : 'certo') : r.timeout ? 'tempo esgotado' : 'errado';
    mount(ui.card,
      h('div', { class: 'cardp-head' }, h('span', {}, c.kind === 'case' ? 'questão de caso' : ACTIONS[c.action]?.name.toLowerCase()), h('span', { class: `cardp-kind is-${c.kind}` }, KIND_LABEL[c.kind]), c.node ? h('span', { class: 'cardp-node' }, nodeName(c.node)) : null),
      h('p', { class: `cardp-verdict ${r.ok ? 'is-ok' : 'is-bad'}` }, verdict),
      h('p', { class: 'cardp-q' }, c.q),
      h('ul', { class: 'cardp-opts is-done' }, c.options.map((o, i) => h('li', {}, h('div', {
        class: `opt${i === c.answer ? ' is-right' : ''}${i === r.pick && !r.ok ? ' is-wrong' : ''}${c.cut.includes(i) && i !== r.pick ? ' is-cut' : ''}`,
      }, h('span', { class: 'opt-key' }, keys[i]), h('span', { class: 'opt-text' }, o, c.optionEn ? h('em', {}, c.optionEn[i]) : null))))),
      c.tell && !r.ok ? h('p', { class: 'cardp-tell' }, h('b', {}, 'O sinal: '), c.tell) : null,
      h('p', { class: `cardp-why${r.ok ? '' : ' is-open'}` }, c.why),
      h('p', { class: 'cardp-next' }, b.status === 'running' ? (b.pendingCase ? 'O chefe interrompe…' : 'Próxima ação quando quiser.') : ''));
  }

  // ----- cronômetro -----

  function startTimer(card) {
    stopTimer();
    timer = { total: card.time * 1000, elapsed: 0, last: performance.now(), raf: 0, warned: 0 };
    const step = (now) => {
      if (!timer) return;
      if (!document.hidden) timer.elapsed += now - timer.last;
      timer.last = now;
      const left = Math.max(0, timer.total - timer.elapsed);
      const frac = left / timer.total;
      if (ui.timerFill) {
        ui.timerFill.style.width = `${frac * 100}%`;
        ui.timerFill.className = `tmr-fill${timer.elapsed <= timer.total * FAST ? ' is-fast' : frac < 0.15 ? ' is-end' : frac < 0.3 ? ' is-low' : ''}`;
        ui.timerText.textContent = `${(left / 1000).toFixed(1)} s${timer.elapsed <= timer.total * FAST ? ' · rápido' : ''}`;
      }
      const secLeft = Math.ceil(left / 1000);
      if (secLeft <= 3 && secLeft > 0 && timer.warned !== secLeft) { timer.warned = secLeft; sfx.click(); }
      if (left <= 0) { const t = timer; stopTimer(); resolve(-1, t.total); return; }
      timer.raf = requestAnimationFrame(step);
    };
    timer.raf = requestAnimationFrame(step);
  }

  function stopTimer() {
    if (timer) cancelAnimationFrame(timer.raf);
    timer = null;
  }

  function onVisibility() {
    if (timer) timer.last = performance.now();
  }

  // ----- interação -----

  function act(id) {
    if (busy) return;
    const card = openCard(b, id);
    if (!card) return;
    sfx.select();
    feedLine(`▸ ${ACTIONS[id].name} (${card.cost} banda)`, 'cmd');
    last = null;
    renderAll();
    if (narrow()) ui.card.scrollIntoView({ block: 'start' });
    startTimer(card);
  }

  const narrow = () => window.matchMedia('(max-width: 980px)').matches;

  function choose(i) {
    if (!b.card || busy || b.card.cut.includes(i)) return;
    resolve(i, timer ? timer.elapsed : 0);
  }

  async function resolve(pick, ms) {
    if (!b.card) return;
    const res = answerCard(b, pick, ms);
    if (!res) return;
    if (res.retry) {
      // pato de borracha: a carta continua aberta e o cronômetro segue de onde estava
      sfx.wrong();
      feedLine('resposta errada · o pato de borracha deixa tentar de novo', 'warn');
      renderCard();
      return;
    }
    stopTimer();
    last = res;
    busy = true;
    renderAll();
    await play(res.events);
    busy = false;
    after();
    if (narrow() && b.status === 'running' && !b.card) (res.ok ? ui.stage : ui.card).scrollIntoView({ block: 'start' });
  }

  async function runScript(i) {
    if (busy) return;
    const ev = useScript(b, i);
    if (!ev) return;
    busy = true;
    renderActions();
    await play(ev);
    busy = false;
    after();
  }

  async function finish() {
    if (busy || !canEndTurn(b)) return;
    busy = true;
    last = null;
    renderAll();
    const ev = endTurn(b);
    await play(ev);
    busy = false;
    after();
  }

  async function after() {
    if (b.status !== 'running') {
      if (ended) return;
      ended = true;
      renderHud();
      renderCard();
      setTimeout(() => { destroy(); onEnd(b); }, 900);
      return;
    }
    if (b.pendingCase && !b.card) {
      renderAll();
      await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 100 : 600));
      const c = openCase(b);
      if (c) { sfx.alarm(); feedLine('▸ questão de caso do chefe', 'alert'); last = null; renderAll(); if (narrow()) ui.card.scrollIntoView({ block: 'start' }); startTimer(c); return; }
    }
    renderAll();
  }

  function renderAll() {
    renderHud();
    renderIntent();
    renderActions();
    renderCard();
    syncScene();
  }

  function feedLine(text, kind = 'info') {
    if (!ui.feed) return;
    ui.feed.appendChild(h('li', { class: `is-${kind}` }, text));
    while (ui.feed.childElementCount > 80) ui.feed.firstChild.remove();
    ui.feed.scrollTop = ui.feed.scrollHeight;
  }

  // ----- animação dos eventos -----

  async function play(events) {
    for (const e of events) {
      if (!scene) return;
      switch (e.type) {
        case 'answer':
          if (e.ok) { if (e.fast) sfx.crit(); else sfx.right(); feedLine(`✓ ${e.fast ? 'certo e rápido' : 'certo'}${e.card.node ? ` · ${nodeName(e.card.node)}` : ''}`, 'ok'); }
          else { sfx.wrong(); feedLine(`✗ ${e.timeout ? 'tempo esgotado' : 'errado'}${e.card.node ? ` · ${nodeName(e.card.node)}` : ''}`, 'warn'); }
          renderHud();
          break;
        case 'hit':
          if (e.src === 'attack' || e.src === 'counter') { sfx.shoot(); await scene.hunt(e.amount, e.crit); }
          else scene.hitEnemy(e.amount, e.crit ? P.W : P.G, e.crit);
          if (e.crit) sfx.crit(); else sfx.hit();
          feedLine(`${e.src === 'counter' ? 'contra-ataque' : e.src === 'case' ? 'caso resolvido' : e.src === 'script' ? 'script' : e.crit ? 'crítico' : 'ataque'}: ${e.amount} de dano${e.absorbed ? ` (${e.absorbed} no bloqueio)` : ''}${e.exposed ? ' · exposto' : ''}`, 'ok');
          renderHud(); syncScene();
          break;
        case 'block': sfx.shield(); feedLine(`bloqueio +${e.amount}${e.fast ? ' (rápido)' : ''}`, 'ok'); renderHud(); syncScene(); await scene.shield(); break;
        case 'negate': sfx.contain(); feedLine(`${e.tech.name} (${e.tech.attack}) identificada: golpe anulado`, 'ok'); renderIntent(); await scene.negated(); break;
        case 'expose': feedLine(`inimigo exposto: +50% de dano${e.turns > 1 ? ` por ${e.turns} turnos` : ' neste turno'}`, 'ok'); renderHud(); syncScene(); break;
        case 'focus':
          if (e.lost) feedLine(`foco perdido (${e.lost})`, 'warn');
          renderHud();
          break;
        case 'stun': sfx.contain(); syncScene(); await scene.stun(); renderIntent(); break;
        case 'enrage': sfx.alarm(); feedLine(`caso errado: o chefe ganhou fúria (+${Math.round(e.rage * 100)}% de dano)`, 'alert'); renderHud(); syncScene(); await scene.phase('resposta errada no caso', 'FURIA'); break;
        case 'phase': sfx.alarm(); feedLine(e.phase.text, 'alert'); renderHud(); syncScene(); await scene.phase('questão de caso', 'INTERRUPCAO'); break;
        case 'retry': break;
        case 'script': sfx.select(); feedLine(`▸ script: ${e.script.name}`, 'cmd'); break;
        case 'heal': sfx.heal(); feedLine(`integridade +${e.amount}`, 'ok'); renderHud(); syncScene(); await scene.heal(e.amount); break;
        case 'ap': feedLine(`banda +${e.amount}`, 'ok'); renderHud(); await scene.boost(); break;
        case 'cut': feedLine(`próxima carta: −${e.amount} alternativa(s) errada(s)`, 'ok'); renderHud(); break;
        case 'cleanse': feedLine('efeitos negativos removidos', 'ok'); renderHud(); await scene.cleanse(); break;
        case 'carry': feedLine(`${e.amount} de banda guardada`, 'dim'); break;
        case 'regen': feedLine(`${enc.name} recupera ${e.amount} de vida`, 'warn'); renderHud(); await scene.enemyHeal(e.amount); break;
        case 'foeBlock': feedLine(`${enc.name} ganhou ${e.amount} de bloqueio${e.passive ? ' (blindado)' : ''}`, 'warn'); renderHud(); syncScene(); await scene.enemyShield(e.amount); break;
        case 'foeBuff': sfx.alarm(); feedLine(`${enc.name} ficou mais forte: +${e.str} por golpe (total +${e.total})`, 'alert'); renderHud(); await scene.enemyBuff(`+${e.str} FORCA`); break;
        case 'foeHeal': feedLine(`${enc.name} recuperou ${e.amount} de vida`, 'warn'); renderHud(); await scene.enemyHeal(e.amount); break;
        case 'skip':
          if (e.reason === 'stun') { feedLine(`${enc.name} está atordoado e perdeu a ação`, 'ok'); }
          else if (e.reason === 'honeypot') { sfx.contain(); feedLine('o ataque caiu no honeypot', 'ok'); await scene.negated('HONEYPOT'); }
          else feedLine(`${e.intent.name || b.ctx.techniques.get(e.intent.tech)?.name || 'golpe'} anulado: nada acontece`, 'ok');
          break;
        case 'enemy': {
          const name = e.intent.name || e.tech?.name || INTENT_TYPES[e.intent.type].name;
          feedLine(`${enc.name}: ${name}${e.tech ? ` (${e.tech.attack})` : ''}`, e.intent.dmg ? 'alert' : 'warn');
          break;
        }
        case 'strike':
          if (e.amount) sfx.hurt(); else sfx.shield();
          await scene.strike({ amount: e.amount, absorbed: e.absorbed, quick: e.hits > 2 });
          feedLine(e.amount ? `−${e.amount} de integridade${e.absorbed ? ` (${e.absorbed} bloqueados)` : ''}` : `golpe bloqueado (${e.absorbed})`, e.amount ? 'alert' : 'ok');
          renderHud(); syncScene();
          break;
        case 'hurt':
          if (e.cause === 'vazamento') { sfx.hurt(); scene.hurt(e.amount); feedLine(`vazamento: −${e.amount} de integridade`, 'alert'); renderHud(); syncScene(); }
          break;
        case 'status': sfx.alarm(); feedLine(`efeito: ${STATUS[e.status].name}${e.turns > 1 ? ` por ${e.turns} turnos` : ''} · ${STATUS[e.status].desc}`, 'alert'); renderHud(); syncScene(); break;
        case 'immune': feedLine(`imune a ${STATUS[e.status].name.toLowerCase()}`, 'ok'); break;
        case 'phoenix': sfx.heal(); feedLine(`backup em fita: você voltou com ${e.amount} de integridade`, 'ok'); renderHud(); await scene.heal(e.amount); break;
        case 'armor': renderHud(); syncScene(); break;
        case 'intent': renderIntent(); break;
        case 'turn': sfx.turn(); feedLine(`— turno ${e.turn} —`, 'dim'); renderAll(); break;
        case 'win': sfx.win(); syncScene(); await scene.win(); break;
        case 'lose': sfx.lose(); syncScene(); await scene.lose('integrity'); break;
        default: break;
      }
    }
  }

  function onKey(e) {
    if (e.target.closest?.('input, textarea') || document.querySelector('.dialog-wrap')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (b.card) {
      const i = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : ['1', '2', '3', '4'].indexOf(k);
      if (i >= 0 && i < b.card.options.length) { e.preventDefault(); choose(i); }
      return;
    }
    if (busy || b.status !== 'running') return;
    if (k === 'e') { e.preventDefault(); finish(); return; }
    const a = Object.values(ACTIONS).find((x) => x.key === k);
    if (a) { e.preventDefault(); act(a.id); }
  }

  build();
  feedLine(`${enc.name} entrou na rede. Olhe a próxima ação dele, acima da cabeça.`, 'info');
  renderAll();
  if (enc.kind === 'boss') scene.banner(enc.name, P.R, enc.title || '');
  return { destroy };
}

// Revisão das cartas de um combate encerrado (usada na recompensa e no fim da operação).
export function answersReview(b, { onlyWrong = false } = {}) {
  const list = b.answers.filter((a) => !onlyWrong || !a.ok);
  if (!list.length) return h('p', { class: 'step-text' }, onlyWrong ? 'Nenhum erro neste combate.' : 'Nenhuma carta respondida.');
  return h('ul', { class: 'review' }, list.map((a) => h('li', { class: `rev${a.ok ? ' is-ok' : ' is-bad'}` },
    h('div', { class: 'rev-head' }, h('span', {}, KIND_LABEL[a.kind]), a.node ? h('span', {}, nodeName(a.node)) : null, h('span', { class: 'rev-mark' }, a.ok ? (a.fast ? 'certo · rápido' : 'certo') : a.pick < 0 ? 'tempo esgotado' : 'errado')),
    h('p', { class: 'rev-prompt' }, a.q),
    h('p', { class: `rev-ans ${a.ok ? 'is-ok' : 'is-bad'}` }, a.ok ? `Resposta: ${a.options[a.answer]}` : [`Certa: ${a.options[a.answer]}`, a.pick >= 0 ? ` · você marcou: ${a.options[a.pick]}` : '']),
    a.tell && !a.ok ? h('p', { class: 'rev-explain' }, h('b', {}, 'O sinal: '), a.tell) : null,
    h('p', { class: 'rev-explain' }, a.why))));
}
