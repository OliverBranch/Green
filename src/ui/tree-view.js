// Mapa de habilidades: topologia radial com os 9 ramos e o painel de detalhes do nó.

import { h, s, clear, duration } from './dom.js';
import { content, LEVELS } from '../content.js';
import * as store from '../state.js';
import { status, progress, prereqsMet, effectText, mastery, examShape, pool } from '../skilltree.js';

const RINGS = [0, 168, 288, 404];
const OFFSET_DEG = 13;
const LABEL_R = 478;
const HEX_R = 27;

let selectedId = null;

const rad = (deg) => (deg * Math.PI) / 180;
const polar = (r, deg) => ({ x: r * Math.cos(rad(deg)), y: r * Math.sin(rad(deg)) });

function sectorDeg() { return 360 / content.branches.length; }
function branchAngle(i) { return -90 + i * sectorDeg(); }

function nodePos(node) {
  const ang = branchAngle(node.branchIndex) + node.offset * OFFSET_DEG;
  return { ...polar(RINGS[node.ring], ang), ang };
}

function hexPoints(r) {
  return Array.from({ length: 6 }, (_, k) => {
    const p = polar(r, 30 + k * 60);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

function arcPath(r, a1, a2, sweep = 1) {
  const p1 = polar(r, a1), p2 = polar(r, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

function wedgePath(r1, r2, a1, a2) {
  const p1 = polar(r1, a1), p2 = polar(r2, a1), p3 = polar(r2, a2), p4 = polar(r1, a2);
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r2} ${r2} 0 0 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${r1} ${r1} 0 0 0 ${p1.x} ${p1.y} Z`;
}

function edgeClass(fromLevel, toNode) {
  const toLevel = progress(toNode.id).level;
  if (fromLevel >= 1 && toLevel >= 1) return 'is-live';
  if (fromLevel >= 1 && prereqsMet(toNode)) return 'is-open';
  return 'is-dead';
}

function renderSvg(onSelect) {
  const sector = sectorDeg();
  const svg = s('svg', { class: 'tree-svg', viewBox: '-540 -540 1080 1080', role: 'group', 'aria-label': 'Mapa de habilidades' });

  svg.appendChild(s('defs', {},
    s('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' },
      s('feGaussianBlur', { stdDeviation: '5', result: 'b' }),
      s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))),
    s('radialGradient', { id: 'core-grad' },
      s('stop', { offset: '0%', 'stop-color': 'var(--phos)', 'stop-opacity': '0.28' }),
      s('stop', { offset: '70%', 'stop-color': 'var(--phos)', 'stop-opacity': '0.05' }),
      s('stop', { offset: '100%', 'stop-color': 'var(--phos)', 'stop-opacity': '0' }))));

  // Grade de fundo: anéis e divisões dos setores
  const grid = s('g', { class: 'tree-grid', 'aria-hidden': 'true' });
  for (let i = 1; i <= 3; i++) grid.appendChild(s('circle', { r: RINGS[i], class: 'ring' }));
  grid.appendChild(s('circle', { r: 452, class: 'ring ring-outer' }));
  content.branches.forEach((b, i) => {
    const a = branchAngle(i) - sector / 2;
    const p1 = polar(96, a), p2 = polar(452, a);
    grid.appendChild(s('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'divider' }));
  });
  svg.appendChild(grid);

  // Destaque do ramo selecionado
  const sel = selectedId && content.nodes.get(selectedId);
  if (sel) {
    const a = branchAngle(sel.branchIndex);
    svg.appendChild(s('path', { class: 'wedge', d: wedgePath(96, 452, a - sector / 2, a + sector / 2), 'aria-hidden': 'true' }));
  }

  // Nomes dos ramos em arco
  const labels = s('g', { class: 'tree-branch-labels', 'aria-hidden': 'true' });
  content.branches.forEach((b, i) => {
    const a = branchAngle(i);
    const norm = ((a % 360) + 360) % 360;
    const bottom = norm > 10 && norm < 170;
    const span = sector / 2 - 2;
    const id = `arc-${b.id}`;
    const d = bottom ? arcPath(LABEL_R + 8, a + span, a - span, 0) : arcPath(LABEL_R, a - span, a + span, 1);
    labels.appendChild(s('path', { id, d, fill: 'none', stroke: 'none' }));
    const m = (() => { let p = 0; for (const n of b.nodes) p += progress(n.id).level; return p; })();
    labels.appendChild(s('text', { class: `branch-label${sel && sel.branch === b.id ? ' is-active' : ''}${m ? ' has-progress' : ''}` },
      s('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, b.name.toLowerCase())));
  });
  svg.appendChild(labels);

  // Conexões
  const edges = s('g', { class: 'tree-edges', 'aria-hidden': 'true' });
  const packets = s('g', { class: 'tree-packets', 'aria-hidden': 'true' });
  for (const n of content.nodes.values()) {
    const to = nodePos(n);
    const sources = n.requires.length ? n.requires.map((r) => content.nodes.get(r)).filter(Boolean) : [null];
    for (const src of sources) {
      const from = src ? nodePos(src) : polar(78, to.ang);
      const fromLevel = src ? progress(src.id).level : 1;
      const cls = edgeClass(fromLevel, n);
      const d = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
      edges.appendChild(s('path', { d, class: `edge ${cls}` }));
      if (cls === 'is-live') packets.appendChild(s('path', { d, class: 'packet', style: { animationDelay: `${(Math.random() * 3).toFixed(2)}s` } }));
    }
  }
  svg.appendChild(edges);
  svg.appendChild(packets);

  // Núcleo
  const m = mastery();
  const core = s('g', { class: 'core' },
    s('circle', { r: 92, fill: 'url(#core-grad)' }),
    s('circle', { r: 84, class: 'core-orbit' }),
    s('circle', { r: 70, class: 'core-ring' }),
    s('text', { class: 'core-pct', y: 6, 'text-anchor': 'middle' }, `${String(Math.round(m.pct * 100)).padStart(2, '0')}%`),
    s('text', { class: 'core-cap', y: 30, 'text-anchor': 'middle' }, 'domínio real'));
  svg.appendChild(core);

  // Nós
  const nodes = s('g', { class: 'tree-nodes' });
  for (const n of content.nodes.values()) {
    const p = nodePos(n);
    const st = status(n);
    const isSel = n.id === selectedId;
    const g = s('g', {
      class: `node is-${st.key}${isSel ? ' is-selected' : ''}`,
      transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`,
      tabindex: '0', role: 'button',
      'aria-label': `${n.name}, ${st.label}${st.level ? `, nível ${st.level} de 3` : ''}`,
      'aria-pressed': String(isSel),
      'data-id': n.id,
    });
    g.addEventListener('click', () => onSelect(n.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id); } });
    if (isSel) g.appendChild(s('circle', { r: HEX_R + 16, class: 'sel-ring' }));
    g.appendChild(s('circle', { r: HEX_R + 10, class: 'hit' }));
    g.appendChild(s('polygon', { points: hexPoints(HEX_R), class: 'hex' }));
    if (st.level) g.appendChild(s('polygon', { points: hexPoints(HEX_R - 5), class: 'hex-fill', style: { opacity: 0.12 + st.level * 0.12 } }));
    [-118, -90, -62].forEach((a, i) => {
      g.appendChild(s('path', { d: arcPath(HEX_R + 8, a - 11, a + 11), class: `pip${st.level > i ? ' is-lit' : ''}` }));
    });
    g.appendChild(s('text', { class: 'node-code', y: 6, 'text-anchor': 'middle' }, n.code));
    g.appendChild(s('text', { class: 'node-label', y: HEX_R + 26, 'text-anchor': 'middle' }, n.short));
    if (st.key === 'cooldown') g.appendChild(s('circle', { r: 4, cx: HEX_R - 2, cy: -HEX_R + 6, class: 'cool-dot' }));
    nodes.appendChild(g);
  }
  svg.appendChild(nodes);
  return svg;
}

// ---------- Painel ----------

function chip(st) {
  return h('span', { class: `chip is-${st.key}` }, st.label);
}

function introPanel() {
  const legend = [
    ['available', 'disponível', 'pode fazer a prova agora'],
    ['unlocked', 'comprovado', 'nível provado; os traços acima do nó mostram quantos'],
    ['cooldown', 'em recarga', 'reprovou; espere para tentar de novo'],
    ['nosignal', 'sem sinal', 'conteúdo ainda não carregado nesta versão'],
    ['locked', 'bloqueado', 'falta comprovar o nó anterior'],
  ];
  return h('div', { class: 'panel-inner' },
    h('h2', { class: 'panel-title' }, 'Seu mapa'),
    h('p', { class: 'panel-lead' }, 'Cada nó é uma habilidade real. Ele só acende quando você passa na prova: sem consulta, com tempo contado e com recarga se reprovar. O bônus no jogo é consequência do que você sabe de verdade.'),
    h('p', { class: 'panel-lead' }, 'Comece pelos nós do anel interno. Clique em um para ver o que ele cobre.'),
    h('dl', { class: 'legend' }, legend.map(([k, t, d]) => [
      h('dt', {}, h('span', { class: `legend-hex is-${k}`, 'aria-hidden': 'true' }), t),
      h('dd', {}, d),
    ])));
}

function nodePanel(node, onExam, onClose) {
  const st = status(node);
  const p = progress(node.id);
  const effect = node.bonus?.effect;
  const active = st.level >= 1;

  const levelRows = [1, 2, 3].map((lv) => {
    const proven = p.level >= lv;
    const count = pool(node.id, lv).length;
    let state;
    if (proven) state = h('span', { class: 'lv-state is-ok' }, 'comprovado');
    else if (count >= 3) state = h('span', { class: 'lv-state' }, `${count} questões no banco`);
    else state = h('span', { class: 'lv-state is-dim' }, 'sem conteúdo ainda');
    return h('li', { class: `lv${proven ? ' is-proven' : ''}` },
      h('span', { class: 'lv-num', 'aria-hidden': 'true' }, String(lv)),
      h('span', { class: 'lv-body' }, h('b', {}, LEVELS[lv].name), h('span', { class: 'lv-desc' }, LEVELS[lv].desc)),
      state);
  });

  const reqs = node.requires.map((r) => {
    const rn = content.nodes.get(r);
    const ok = progress(r).level >= 1;
    return h('li', { class: ok ? 'is-ok' : 'is-miss' }, h('span', { 'aria-hidden': 'true' }, ok ? '✓ ' : '× '), rn?.name || r,
      h('span', { class: 'sr-only' }, ok ? ' (comprovado)' : ' (pendente)'));
  });

  let action;
  if (st.canExam) {
    const shape = examShape(node.id, st.next);
    action = h('div', { class: 'panel-action' },
      h('button', { class: 'btn btn-primary btn-wide', onclick: () => onExam(node.id, st.next) }, `Fazer prova de ${LEVELS[st.next].name.toLowerCase()}`),
      h('p', { class: 'panel-note' }, `${shape.size} questões, aprovação com ${shape.need}.`));
  } else if (st.key === 'cooldown') {
    const timer = h('span', { class: 'cool-timer' }, duration(st.cooldown));
    action = h('div', { class: 'panel-action' },
      h('button', { class: 'btn btn-wide', disabled: true }, 'Prova em recarga'),
      h('p', { class: 'panel-note is-warn' }, 'Nova tentativa em ', timer, '. Use o tempo para revisar o assunto.'));
    action.dataset.until = String(p.cooldownUntil);
  } else if (st.key === 'locked') {
    action = h('div', { class: 'panel-action' }, h('p', { class: 'panel-note' }, 'Comprove os pré-requisitos para liberar esta prova.'));
  } else if (st.key === 'mastered') {
    action = h('div', { class: 'panel-action' }, h('p', { class: 'panel-note is-ok' }, 'Os três níveis estão comprovados.'));
  } else if (st.noContent) {
    action = h('div', { class: 'panel-action' }, h('p', { class: 'panel-note' }, `As questões de ${LEVELS[st.next].name.toLowerCase()} deste nó entram numa próxima versão.`));
  }

  return h('div', { class: 'panel-inner' },
    h('div', { class: 'panel-head' },
      h('span', { class: 'panel-branch' }, node.branchName),
      h('button', { class: 'icon-btn', 'aria-label': 'Fechar detalhes', onclick: onClose }, '×')),
    h('h2', { class: 'panel-title', tabindex: '-1' }, h('span', { class: 'panel-code' }, node.code), node.name),
    chip(st),
    h('p', { class: 'panel-lead' }, node.summary),
    h('section', { class: 'panel-sec' },
      h('h3', {}, 'Níveis'),
      h('ol', { class: 'levels' }, levelRows)),
    node.bonus ? h('section', { class: 'panel-sec' },
      h('h3', {}, 'Bônus no jogo'),
      h('div', { class: `bonus${active ? ' is-active' : ''}` },
        h('b', {}, node.bonus.label),
        h('p', {}, effectText(effect)),
        h('span', { class: 'bonus-state' }, active ? `ativo no nível ${st.level}` : 'inativo até a primeira prova'))) : null,
    reqs.length ? h('section', { class: 'panel-sec' }, h('h3', {}, 'Pré-requisitos'), h('ul', { class: 'reqs' }, reqs)) : null,
    action);
}

// ---------- Montagem ----------

export function mountTree(container, { onExam }) {
  const stage = h('div', { class: 'map-stage' });
  const panel = h('aside', { class: 'map-panel', 'aria-live': 'polite', 'aria-label': 'Detalhes do nó' });
  const root = h('div', { class: 'map' }, stage, panel);
  clear(container).appendChild(root);

  const select = (id) => {
    selectedId = id === selectedId ? null : id;
    render();
    if (selectedId) panel.querySelector('.panel-title')?.focus?.();
  };

  function render() {
    const focusedId = document.activeElement?.closest?.('.node')?.dataset.id;
    clear(stage).appendChild(renderSvg(select));
    const node = selectedId && content.nodes.get(selectedId);
    clear(panel).appendChild(node ? nodePanel(node, onExam, () => select(selectedId)) : introPanel());
    panel.classList.toggle('has-node', !!node);
    if (focusedId) stage.querySelector(`.node[data-id="${focusedId}"]`)?.focus();
  }

  render();
  const unsub = store.subscribe(render);
  const tick = setInterval(() => {
    const el = panel.querySelector('.panel-action[data-until]');
    if (!el) return;
    const left = Number(el.dataset.until) - Date.now();
    if (left <= 0) render();
    else el.querySelector('.cool-timer').textContent = duration(left);
  }, 1000);

  return {
    select: (id) => { selectedId = null; select(id); },
    destroy: () => { unsub(); clearInterval(tick); },
  };
}
