// Estrutura principal: barra superior, navegação, área de conteúdo e console.

import { h, clear, mount } from './dom.js';
import { content } from '../content.js';
import * as store from '../state.js';
import { rank, mastery, status } from '../skilltree.js';
import { mountTree } from './tree-view.js';
import { mountMissions, openMission } from './mission-view.js';
import { mountProfile } from './profile-view.js';
import { openExam } from './exam-view.js';
import { mountConsole, log } from './console.js';

const ROUTES = [
  { id: 'mapa', label: 'mapa', title: 'Mapa de habilidades' },
  { id: 'missoes', label: 'missões', title: 'Contratos' },
  { id: 'perfil', label: 'perfil', title: 'Perfil' },
];

export function mountShell(root) {
  const topStats = h('div', { class: 'top-stats' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Seções' });
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  const con = h('div', { class: 'console' });
  const shell = h('div', { class: 'shell' },
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/mapa', 'aria-label': 'GREEN, ir para o mapa' }, 'green', h('span', { class: 'brand-cursor', 'aria-hidden': 'true' })),
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

  function renderNav() {
    mount(nav, h('ul', {}, ROUTES.map((r) => h('li', {},
      h('a', { href: `#/${r.id}`, class: `nav-link${current === r.id ? ' is-active' : ''}`, 'aria-current': current === r.id ? 'page' : null },
        h('span', { class: 'nav-path', 'aria-hidden': 'true' }, '~/'), r.label)))));
  }

  const startExam = (nodeId, level) => openExam(nodeId, level, { onClose: () => {} });
  const goNode = (id) => {
    if (current !== 'mapa') { location.hash = '#/mapa'; route(); }
    view?.select?.(id);
  };

  function route() {
    const id = (location.hash.replace(/^#\/?/, '') || 'mapa').split('/')[0];
    const target = ROUTES.find((r) => r.id === id) ? id : 'mapa';
    if (target === current && view) return;
    view?.destroy?.();
    current = target;
    renderNav();
    document.title = `${ROUTES.find((r) => r.id === target).title} · GREEN`;
    if (target === 'mapa') view = mountTree(main, { onExam: startExam });
    if (target === 'missoes') view = mountMissions(main, { onOpen: (mid) => openMission(mid, { onNode: goNode }), onNode: goNode });
    if (target === 'perfil') view = mountProfile(main, { onNode: goNode });
    main.scrollTop = 0;
  }

  const commands = {
    help: (_, { print }) => {
      print('comandos: status · nos [ramo] · prova <código> · missao [id] · ir <mapa|missoes|perfil> · exportar · limpar · whoami');
    },
    status: (_, { print }) => {
      const s = store.get(); const r = rank(s.xp); const m = mastery();
      print(`${s.operator} · ${r.name.toLowerCase()} · ${s.xp} xp · domínio ${m.proven}/${m.total} · reputação ${s.reputation}`);
    },
    whoami: (_, { print }) => print(store.get().operator),
    nos: (args, { print }) => {
      const q = (args[0] || '').toLowerCase();
      for (const b of content.branches) {
        if (q && !b.id.startsWith(q) && !b.name.toLowerCase().includes(q)) continue;
        print(`${b.name.toLowerCase()}: ${b.nodes.map((n) => `${n.code}[${status(n).label}]`).join('  ')}`);
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
    ir: (args, { print }) => {
      const r = ROUTES.find((x) => x.id === (args[0] || '').replace('õ', 'o'));
      if (!r) { print('uso: ir mapa | ir missoes | ir perfil', 'warn'); return; }
      location.hash = `#/${r.id}`;
    },
    exportar: (_, { print }) => { store.exportSave(); print('save exportado', 'ok'); },
    limpar: () => { document.querySelector('.con-out')?.replaceChildren(); },
    clear: () => { document.querySelector('.con-out')?.replaceChildren(); },
    ls: (_, { print }) => print('mapa/  missoes/  perfil/  conteudo.json  .nao_tem_flag_aqui'),
    sudo: (_, { print }) => print(`${store.get().operator} não está no arquivo sudoers. este incidente será reportado.`, 'alert'),
    cat: (args, { print }) => print(args[0]?.includes('flag') ? 'boa tentativa. a única flag aqui é o nó que você comprova.' : `cat: ${args[0] || ''}: arquivo não encontrado`, 'warn'),
  };

  mountConsole(con, commands);
  renderTop();
  store.subscribe(() => { renderTop(); applyFx(); });
  window.addEventListener('hashchange', route);
  route();
}

export function applyFx() {
  document.body.classList.toggle('fx', !!store.get().settings.effects);
}

export { log };
