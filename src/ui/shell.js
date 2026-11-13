// Estrutura principal: barra superior, navegação, área de conteúdo e console.

import { h, clear, mount } from './dom.js';
import { content } from '../content.js';
import * as store from '../state.js';
import { rank, mastery, status } from '../skilltree.js';
import { mountTree } from './tree-view.js';
import { mountMissions, openMission } from './mission-view.js';
import { mountOperation, openRun, playerAttrs, sheet } from './run-view.js';
import { ACT_NAMES } from '../run.js';
import { PALETTE as P, iconURL } from './pixel.js';
import { portrait as avatarPortrait, scaled } from './avatar.js';
import { openAvatarEditor } from './avatar-view.js';
import { openPetEditor, mountCornerCat } from './pet-view.js';
import { portrait as catPortrait } from './pet.js';
import { ATTRS } from '../attributes.js';
import { mountProfile } from './profile-view.js';
import { openExam } from './exam-view.js';
import { mountConsole, log } from './console.js';

const ROUTES = [
  { id: 'operacao', label: 'Operação', path: 'operacao', icon: 'sword', title: 'Operação' },
  { id: 'mapa', label: 'Habilidades', path: 'mapa', icon: 'brain', title: 'Mapa de habilidades' },
  { id: 'missoes', label: 'Contratos', path: 'missoes', icon: 'doc', title: 'Contratos' },
  { id: 'perfil', label: 'Perfil', path: 'perfil', icon: 'cert', title: 'Perfil' },
];
const HOME = 'operacao';

let cat = null;

export function mountShell(root) {
  const topStats = h('div', { class: 'top-stats' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Seções' });
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  const con = h('div', { class: 'console' });
  const shell = h('div', { class: 'shell' },
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: `#/${HOME}`, 'aria-label': 'GREEN, ir para a operação' }, 'green', h('span', { class: 'brand-cursor', 'aria-hidden': 'true' })),
      topStats),
    nav, main, con);
  clear(root).appendChild(shell);

  let view = null;
  let current = null;

  function renderTop() {
    const s = store.get();
    const r = rank(s.xp);
    const m = mastery();
    mount(topStats, 
      h('span', { class: 'ts-op' }, h('span', { class: 'ts-k' }, 'op'), s.operator),
      h('span', { class: 'ts-rank' },
        h('span', { class: 'ts-k' }, r.name.toLowerCase()),
        h('span', { class: 'ts-xp', role: 'meter', 'aria-label': `${s.xp} XP`, 'aria-valuenow': String(s.xp) },
          h('span', { style: { width: `${Math.round(r.progress * 100)}%` } })),
        h('span', { class: 'ts-v' }, `${s.xp} xp`)),
      h('span', { class: 'ts-mastery' }, h('span', { class: 'ts-k' }, 'domínio'), `${m.proven}/${m.total}`),
      h('span', { class: 'ts-rep' }, h('span', { class: 'ts-k' }, 'rep'), String(s.reputation)));
  }

  // ----- menu lateral -----

  const navIcon = (name, on) => h('img', { class: 'nav-icon pix', src: iconURL(name, on ? P.G : P.m), alt: '', 'aria-hidden': 'true' });

  // status ao vivo de cada seção: o que tem para fazer ali
  function navStatus(id) {
    const s = store.get();
    if (id === 'operacao') {
      const run = s.run;
      if (run && !['dead', 'won'].includes(run.status)) {
        const low = run.hp < run.maxHp * 0.35;
        return { sub: `ato ${run.act} · andar ${run.floor}`, badge: `${run.hp}/${run.maxHp}`, kind: low ? 'alert' : 'live', live: true };
      }
      return { sub: s.stats.runs ? `${s.stats.runsWon || 0} vitória(s) em ${s.stats.runs}` : 'roguelike · 3 atos', badge: null };
    }
    if (id === 'mapa') {
      const m = mastery();
      let ready = 0;
      for (const n of content.nodes.values()) if (status(n).canExam) ready++;
      return { sub: `${m.proven}/${m.total} níveis`, badge: ready ? String(ready) : null, kind: 'go', badgeTitle: `${ready} nó(s) com prova disponível` };
    }
    if (id === 'missoes') {
      const done = content.missions.filter((m) => s.missions[m.id]?.completions).length;
      return { sub: `${done}/${content.missions.length} concluído(s)`, badge: null };
    }
    if (id === 'perfil') return { sub: 'ficha, registro e save', badge: null };
    return { sub: '', badge: null };
  }

  function renderNav() {
    const s = store.get();
    const r = rank(s.xp);
    const attrs = playerAttrs();
    mount(nav,
      h('p', { class: 'nav-k' }, '// seções'),
      h('ul', { class: 'nav-list' }, ROUTES.map((rt, i) => {
        const on = current === rt.id;
        const st = navStatus(rt.id);
        return h('li', {}, h('a', {
          href: `#/${rt.path}`, class: `nav-link${on ? ' is-active' : ''}${st.live ? ' is-live' : ''}`,
          'aria-current': on ? 'page' : null, title: `${rt.title} (Alt+${i + 1})`,
        },
          navIcon(rt.icon, on || st.live),
          h('span', { class: 'nav-text' },
            h('span', { class: 'nav-label' }, rt.label),
            h('span', { class: 'nav-sub' }, st.sub)),
          st.badge ? h('span', { class: `nav-badge is-${st.kind || 'info'}`, title: st.badgeTitle || null }, st.live ? h('i', { class: 'nav-dot', 'aria-hidden': 'true' }) : null, st.badge) : null));
      })),
      h('div', { class: 'nav-card' },
        h('a', { class: 'nav-card-top', href: '#/perfil', title: 'Perfil e ficha do analista' },
          s.avatar
            ? h('span', { class: 'nav-avatar is-pix', 'aria-hidden': 'true' }, scaled(avatarPortrait(s.avatar), 2))
            : h('span', { class: 'nav-avatar', 'aria-hidden': 'true' }, (s.operator || '?').slice(0, 1).toUpperCase()),
          h('span', { class: 'nav-who' }, h('b', {}, s.operator || 'operador'), h('span', {}, r.name.toLowerCase()),
          )),
        h('span', { class: 'nav-edits' },
          h('button', { class: 'nav-edit', onclick: () => openAvatarEditor({ first: !s.avatar }) }, s.avatar ? '✎ personagem' : '+ personagem'),
          h('button', { class: 'nav-edit', onclick: () => openPetEditor({ first: !s.pet }) },
            s.pet ? [scaled(catPortrait(s.pet), 1), ` ${s.pet.name}`] : '+ adotar gato')),
        h('span', { class: 'nav-xp', role: 'meter', 'aria-label': `${s.xp} XP`, 'aria-valuenow': String(s.xp) }, h('span', { style: { width: `${Math.round(r.progress * 100)}%` } })),
        h('span', { class: 'nav-xp-text' }, r.ceil ? `${s.xp} / ${r.ceil} xp` : `${s.xp} xp`),
        h('span', { class: 'nav-k' }, 'ficha do analista'),
        sheet(attrs, { compact: true })),
      h('p', { class: 'nav-foot' }, h('span', {}, `v${content.version}`), h('span', {}, h('kbd', {}, '`'), ' terminal')));
  }

  const startExam = (nodeId, level) => openExam(nodeId, level, { onClose: () => {} });
  const goNode = (id) => {
    if (current !== 'mapa') { location.hash = '#/mapa'; route(); }
    view?.select?.(id);
  };

  function route() {
    let id = (location.hash.replace(/^#\/?/, '') || HOME).split('/')[0];
    if (id === 'incidentes') id = 'operacao';
    const target = ROUTES.find((r) => r.id === id) ? id : HOME;
    if (target === current && view) return;
    view?.destroy?.();
    current = target;
    renderNav();
    document.title = `${ROUTES.find((r) => r.id === target).title} · GREEN`;
    if (target === 'mapa') view = mountTree(main, { onExam: startExam });
    if (target === 'missoes') view = mountMissions(main, { onOpen: (mid) => openMission(mid, { onNode: goNode }), onNode: goNode });
    if (target === 'operacao') view = mountOperation(main, { onNode: goNode });
    if (target === 'perfil') view = mountProfile(main, { onNode: goNode });
    main.scrollTop = 0;
  }

  const commands = {
    help: (_, { print }) => {
      print('comandos: status · nos [ramo] · prova <código> · missao [id] · operacao · ficha · personagem · gato · miau · ir <mapa|missoes|operacao|perfil> · som · exportar · limpar · whoami');
    },
    status: (_, { print }) => {
      const s = store.get(); const r = rank(s.xp); const m = mastery();
      print(`${s.operator} · ${r.name.toLowerCase()} · ${s.xp} xp · domínio ${m.proven}/${m.total} · reputação ${s.reputation} · operações ${s.stats.runsWon || 0}/${s.stats.runs || 0}`);
    },
    whoami: (_, { print }) => print(store.get().operator),
    nos: (args, { print }) => {
      const q = (args[0] || '').toLowerCase();
      const rust = store.get().rust || {};
      for (const b of content.branches) {
        if (q && !b.id.startsWith(q) && !b.name.toLowerCase().includes(q)) continue;
        print(`${b.name.toLowerCase()}: ${b.nodes.map((n) => `${n.code}[${status(n).label}${rust[n.id] ? ', enferrujado' : ''}]`).join('  ')}`);
      }
    },
    prova: (args, { print, setOpen }) => {
      const code = (args[0] || '').toUpperCase();
      const node = [...content.nodes.values()].find((n) => n.code === code || n.id === args[0]);
      if (!node) { print('uso: prova <código>, por exemplo: prova AES', 'warn'); return; }
      const st = status(node);
      if (!st.canExam) { print(`${node.code}: ${st.label}, prova indisponível`, 'warn'); return; }
      setOpen(false);
      startExam(node.id, st.next);
    },
    missao: (args, { print, setOpen }) => {
      if (!args[0]) { content.missions.forEach((m) => print(`${m.id} · ${m.title} · ${m.kind}`)); return; }
      const m = content.missions.find((x) => x.id === args[0].toLowerCase());
      if (!m) { print('missão não encontrada', 'warn'); return; }
      setOpen(false);
      openMission(m.id, { onNode: goNode });
    },
    operacao: (_, { print, setOpen }) => {
      const run = store.get().run;
      if (run && !['dead', 'won'].includes(run.status)) { setOpen(false); location.hash = '#/operacao'; openRun({ onNode: goNode }); return; }
      print('nenhuma operação em andamento. abra a aba operação para começar uma.', 'info');
      location.hash = '#/operacao';
    },
    personagem: (_, { setOpen }) => { setOpen(false); openAvatarEditor({}); },
    gato: (_, { setOpen }) => { setOpen(false); openPetEditor({}); },
    pet: (_, { setOpen }) => { setOpen(false); openPetEditor({}); },
    miau: (_, { print }) => {
      const p = store.get().pet;
      if (!p) { print('você ainda não tem um gato. digite gato para adotar um.', 'warn'); return; }
      cat?.pat();
      print(`${p.name}: =^.^=`, 'ok');
    },
    avatar: (_, { setOpen }) => { setOpen(false); openAvatarEditor({}); },
    ficha: (_, { print }) => {
      const a = playerAttrs();
      for (const at of ATTRS) print(`${at.name.toLowerCase().padEnd(12)} ${at.fmt(a[at.key]).padEnd(22)} ${at.branch} · patamar ${a.tiers[at.branch]} · ${a.xp[at.branch]} xp`);
      if (a.hops) print(`mobilidade: ${a.hops} salto(s) lateral(is) por ato no mapa`, 'ok');
    },
    som: (_, { print }) => {
      store.update((s) => { s.settings.sound = !s.settings.sound; });
      print(`som ${store.get().settings.sound ? 'ligado' : 'desligado'}`, 'ok');
    },
    ir: (args, { print }) => {
      const r = ROUTES.find((x) => x.id === (args[0] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      if (!r) { print('uso: ir mapa | ir missoes | ir operacao | ir perfil', 'warn'); return; }
      location.hash = `#/${r.id}`;
    },
    exportar: (_, { print }) => { store.exportSave(); print('save exportado', 'ok'); },
    limpar: () => { document.querySelector('.con-out')?.replaceChildren(); },
    clear: () => { document.querySelector('.con-out')?.replaceChildren(); },
    ls: (_, { print }) => print('mapa/  missoes/  operacao/  perfil/  conteudo.json  .nao_tem_flag_aqui'),
    sudo: (_, { print }) => print(`${store.get().operator} não está no arquivo sudoers. este incidente será reportado.`, 'alert'),
    cat: (args, { print }) => print(args[0]?.includes('flag') ? 'boa tentativa. a única flag aqui é o nó que você comprova.' : `cat: ${args[0] || ''}: arquivo não encontrado`, 'warn'),
  };

  mountConsole(con, commands);
  renderTop();
  store.subscribe(() => { renderTop(); renderNav(); applyFx(); });
  window.addEventListener('hashchange', route);
  // primeira vez (ou save antigo): convida a criar o personagem e depois a adotar o gato
  const onboarding = () => {
    if (document.querySelector('.overlay')) return;
    const st = store.get();
    if (!st.avatar && !st.avatarSkipped) openAvatarEditor({ first: true, onDone: onboarding });
    else if (!st.pet && !st.petSkipped) openPetEditor({ first: true });
  };
  setTimeout(onboarding, 400);
  cat = mountCornerCat();
  // Alt+1..4 troca de seção (fora de provas e da operação aberta)
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.overlay')) return;
    const rt = ROUTES[Number(e.key) - 1];
    if (rt) { e.preventDefault(); location.hash = `#/${rt.path}`; }
  });
  route();
}

export function applyFx() {
  document.body.classList.toggle('fx', !!store.get().settings.effects);
}

export { log };
