// Criação do personagem: editor com prévia ao vivo (de frente e na estação de trabalho).

import { h, mount, trapFocus } from './dom.js';
import * as store from '../state.js';
import {
  BODIES, SKINS, HAIRS, HAIR_COLORS, BEARDS, GLASSES, TOPS, CLOTH_COLORS, ACCENT_COLORS,
  DEFAULT_AVATAR, normalize, randomAvatar, portrait, workstation, scaled,
} from './avatar.js';
import { sfx } from './sfx.js';
import { log } from './console.js';

// Abre o editor. `first` muda os textos para a primeira vez (com opção de deixar para depois).
export function openAvatarEditor({ first = false, onDone } = {}) {
  const s = store.get();
  let av = normalize(s.avatar || DEFAULT_AVATAR);
  const body = h('div', { class: 'exam-body av-body' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Criar personagem' },
    h('div', { class: 'overlay-frame av-frame' }, body));
  document.body.appendChild(overlay);
  document.body.classList.add('has-overlay');
  const release = trapFocus(overlay);

  function close(saved) {
    release();
    overlay.remove();
    if (!document.querySelector('.overlay')) document.body.classList.remove('has-overlay');
    onDone?.(saved);
  }
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel(); });

  function cancel() {
    if (first) store.update((x) => { x.avatarSkipped = true; });
    close(false);
  }

  function save() {
    const had = !!store.get().avatar;
    store.update((x) => { x.avatar = { ...av }; x.avatarSkipped = true; });
    sfx.select();
    log(`personagem ${had ? 'atualizado' : 'criado'}`, 'ok');
    close(true);
  }

  const set = (patch) => { av = normalize({ ...av, ...patch }); sfx.click(); render(); };

  // ----- controles -----

  // opções com miniatura: o próprio personagem com aquela opção aplicada
  function thumbs(key, list, extra = {}) {
    return h('div', { class: 'av-thumbs', role: 'radiogroup' }, list.map(([id, label]) => {
      const on = av[key] === id;
      const pv = normalize({ ...av, [key]: id, ...extra });
      return h('button', { class: `av-thumb${on ? ' is-on' : ''}`, role: 'radio', 'aria-checked': String(on), title: label, onclick: () => set({ [key]: id, ...extra }) },
        scaled(portrait(pv), 2), h('span', {}, label));
    }));
  }

  function swatches(key, list, label) {
    return h('div', { class: 'av-swatches', role: 'radiogroup', 'aria-label': label }, list.map((entry) => {
      const [color, name] = Array.isArray(entry) ? entry : [entry, entry];
      const on = av[key] === color;
      return h('button', { class: `av-sw${on ? ' is-on' : ''}`, role: 'radio', 'aria-checked': String(on), title: name, 'aria-label': name, style: { background: color }, onclick: () => set({ [key]: color }) });
    }));
  }

  function toggle(key, label, disabled = false, hint = '') {
    const on = !!av[key];
    return h('button', { class: `av-toggle${on ? ' is-on' : ''}`, 'aria-pressed': String(on), disabled, title: hint || null, onclick: () => set({ [key]: !on }) },
      h('span', { class: 'av-box', 'aria-hidden': 'true' }, on ? '■' : ''), label);
  }

  const row = (title, ...content) => h('section', { class: 'av-row' }, h('h3', {}, title), ...content);

  function render() {
    const name = store.get().operator || 'operador';
    mount(body,
      h('div', { class: 'exam-head' },
        h('span', { class: 'exam-kicker' }, first ? 'novo operador · personagem' : 'perfil · personagem'),
        h('button', { class: 'btn btn-ghost btn-small', onclick: cancel }, first ? 'Depois' : 'Cancelar')),
      h('h1', { class: 'exam-title' }, first ? 'Crie seu analista' : 'Personagem'),
      h('p', { class: 'exam-sub' }, 'É você na estação de trabalho do SOC durante os combates. Dá para mudar quando quiser, no perfil.'),
      h('div', { class: 'av-grid' },
        h('div', { class: 'av-preview' },
          h('div', { class: 'av-portrait' }, scaled(portrait(av), 7)),
          h('p', { class: 'av-name' }, name),
          h('div', { class: 'av-desk' }, scaled(workstation(av), 4)),
          h('p', { class: 'av-cap' }, 'no SOC, durante o combate'),
          h('button', { class: 'btn btn-small', onclick: () => { av = randomAvatar(); sfx.select(); render(); } }, '⚄ Aleatório')),
        h('div', { class: 'av-options' },
          row('Corpo', thumbs('body', BODIES)),
          row('Pele', swatches('skin', SKINS, 'Tom de pele')),
          row('Cabelo', thumbs('hair', HAIRS, av.hood ? { hood: false } : {}), swatches('hairColor', HAIR_COLORS, 'Cor do cabelo')),
          row('Rosto', h('p', { class: 'av-sub' }, 'barba'), thumbs('beard', BEARDS), h('p', { class: 'av-sub' }, 'óculos'), thumbs('glasses', GLASSES)),
          row('Roupa', thumbs('top', TOPS), swatches('topColor', CLOTH_COLORS, 'Cor da roupa'),
            h('div', { class: 'av-toggles' }, toggle('hood', 'Capuz levantado', av.top !== 'moletom', 'Só com moletom'))),
          row('Acessórios', h('div', { class: 'av-toggles' }, toggle('phones', 'Fone de ouvido'), toggle('cap', 'Boné', av.hood, 'Não dá com o capuz levantado')),
            h('p', { class: 'av-sub' }, 'cor do fone, boné e detalhes'), swatches('accent', ACCENT_COLORS, 'Cor de destaque')))),
      h('div', { class: 'exam-actions av-actions' },
        h('button', { class: 'btn btn-ghost', onclick: cancel }, first ? 'Deixar para depois' : 'Cancelar'),
        h('button', { class: 'btn btn-primary', onclick: save }, 'Salvar personagem')));
  }

  render();
  body.querySelector('.av-thumb.is-on')?.focus({ preventScroll: true });
}
