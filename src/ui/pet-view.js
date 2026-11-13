// O gato: editor de criação e o gatinho que mora no canto da tela.

import { h, mount, trapFocus, prefersReducedMotion } from './dom.js';
import * as store from '../state.js';
import {
  FUR_COLORS, EYE_COLORS, PATTERNS, EXPRESSIONS, EARS, TAILS, SIZES, NECKS, NECK_COLORS, NAMES,
  DEFAULT_PET, normalizePet, randomPet, portrait as catPortrait, deskCat,
} from './pet.js';
import { workstation, scaled } from './avatar.js';
import { sfx } from './sfx.js';
import { log } from './console.js';

// ---------- editor ----------

export function openPetEditor({ first = false, onDone } = {}) {
  let pet = normalizePet(store.get().pet || { ...DEFAULT_PET, name: NAMES[Math.floor(Math.random() * NAMES.length)] });
  const body = h('div', { class: 'exam-body av-body' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Criar gato' },
    h('div', { class: 'overlay-frame av-frame' }, body));
  document.body.appendChild(overlay);
  document.body.classList.add('has-overlay');
  const release = trapFocus(overlay);
  let tailTimer = null;

  function close(saved) {
    clearInterval(tailTimer);
    release();
    overlay.remove();
    if (!document.querySelector('.overlay')) document.body.classList.remove('has-overlay');
    onDone?.(saved);
  }
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.tagName !== 'INPUT') cancel(); });

  function cancel() {
    if (first) store.update((x) => { x.petSkipped = true; });
    close(false);
  }

  function save() {
    const had = !!store.get().pet;
    store.update((x) => { x.pet = { ...pet }; x.petSkipped = true; });
    sfx.meow();
    log(`${pet.name} ${had ? 'mudou de visual' : 'entrou para o SOC'} =^.^=`, 'ok');
    close(true);
  }

  const set = (patch) => { pet = normalizePet({ ...pet, ...patch }); sfx.click(); render(); };

  function thumbs(key, list, extra = {}) {
    return h('div', { class: 'av-thumbs', role: 'radiogroup' }, list.map(([id, label]) => {
      const on = pet[key] === id;
      return h('button', { class: `av-thumb${on ? ' is-on' : ''}`, role: 'radio', 'aria-checked': String(on), title: label, onclick: () => set({ [key]: id, ...extra }) },
        scaled(catPortrait({ ...pet, [key]: id, ...extra }), 2), h('span', {}, label));
    }));
  }

  function swatches(key, list, label) {
    return h('div', { class: 'av-swatches', role: 'radiogroup', 'aria-label': label }, list.map(([color, name]) => {
      const on = pet[key] === color;
      return h('button', { class: `av-sw${on ? ' is-on' : ''}`, role: 'radio', 'aria-checked': String(on), title: name, 'aria-label': name, style: { background: color }, onclick: () => set({ [key]: color }) });
    }));
  }

  function toggle(key, label, hint = '') {
    const on = !!pet[key];
    return h('button', { class: `av-toggle${on ? ' is-on' : ''}`, 'aria-pressed': String(on), title: hint || null, onclick: () => set({ [key]: !on }) },
      h('span', { class: 'av-box', 'aria-hidden': 'true' }, on ? '■' : ''), label);
  }

  const row = (title, ...content) => h('section', { class: 'av-row' }, h('h3', {}, title), ...content);
  let frameTail = 0;

  function previewArt() {
    const [fn, k] = deskCat(pet, { tail: frameTail });
    const av = store.get().avatar || {};
    return [
      h('div', { class: 'av-portrait pet-portrait' }, scaled(catPortrait(pet, { tail: frameTail }), 7)),
      h('p', { class: 'av-name' }, pet.name),
      h('div', { class: 'av-desk' }, scaled(workstation(av, fn, k), 4)),
    ];
  }

  function render() {
    const usesSecond = ['listrado', 'manchado', 'frajola', 'siames', 'tricolor'].includes(pet.pattern) && pet.pattern !== 'frajola';
    const nameInput = h('input', {
      class: 'pet-name', type: 'text', maxlength: '14', value: pet.name, 'aria-label': 'Nome do gato', spellcheck: 'false',
      oninput: (e) => { pet = normalizePet({ ...pet, name: e.target.value || 'Bit' }); body.querySelector('.av-name').textContent = pet.name; },
    });
    mount(body,
      h('div', { class: 'exam-head' },
        h('span', { class: 'exam-kicker' }, first ? 'todo analista tem um gato' : 'perfil · gato'),
        h('button', { class: 'btn btn-ghost btn-small', onclick: cancel }, first ? 'Depois' : 'Cancelar')),
      h('h1', { class: 'exam-title' }, first ? 'Adote um gato' : 'Seu gato'),
      h('p', { class: 'exam-sub' }, 'Ele fica na sua mesa durante os combates e mora no canto da tela. Clique nele para fazer carinho.'),
      h('div', { class: 'av-grid' },
        h('div', { class: 'av-preview' }, ...previewArt(),
          h('p', { class: 'av-cap' }, 'na sua mesa, durante o combate'),
          h('button', { class: 'btn btn-small', onclick: () => { pet = randomPet(); sfx.meow(); render(); } }, '⚄ Aleatório')),
        h('div', { class: 'av-options' },
          row('Nome', h('div', { class: 'pet-name-row' }, nameInput,
            h('button', { class: 'btn btn-small btn-ghost', onclick: () => { set({ name: NAMES[Math.floor(Math.random() * NAMES.length)] }); } }, 'sortear nome'))),
          row('Pelagem', h('p', { class: 'av-sub' }, pet.pattern === 'tricolor' ? 'cor 1 (as manchas sobre o branco)' : 'cor principal'), swatches('fur', FUR_COLORS, 'Cor do pelo'),
            thumbs('pattern', PATTERNS),
            usesSecond ? [h('p', { class: 'av-sub' }, pet.pattern === 'siames' ? 'cor das pontas (rosto, orelhas, patas e rabo)' : pet.pattern === 'tricolor' ? 'cor 2' : 'cor das listras ou manchas'), swatches('fur2', FUR_COLORS, 'Cor secundária')] : null),
          row('Olhos', swatches('eyes', EYE_COLORS, 'Cor dos olhos'),
            h('div', { class: 'av-toggles' }, toggle('hetero', 'Heterocromia (um olho de cada cor)'), toggle('cross', 'Vesgo')),
            pet.hetero ? [h('p', { class: 'av-sub' }, 'cor do outro olho'), swatches('eyes2', EYE_COLORS, 'Cor do outro olho')] : null,
            h('p', { class: 'av-sub' }, 'expressão'), thumbs('expr', EXPRESSIONS)),
          row('Corpo', h('p', { class: 'av-sub' }, 'tamanho'), thumbs('size', SIZES), h('p', { class: 'av-sub' }, 'orelhas'), thumbs('ears', EARS), h('p', { class: 'av-sub' }, 'rabo'), thumbs('tail', TAILS)),
          row('Pescoço', thumbs('neck', NECKS), pet.neck !== 'nenhum' ? swatches('neckColor', NECK_COLORS, 'Cor do acessório') : null))),
      h('div', { class: 'exam-actions av-actions' },
        h('button', { class: 'btn btn-ghost', onclick: cancel }, first ? 'Deixar para depois' : 'Cancelar'),
        h('button', { class: 'btn btn-primary', onclick: save }, first ? 'Adotar' : 'Salvar gato')));
  }

  render();
  body.querySelector('.av-thumb.is-on')?.focus({ preventScroll: true });
  if (!prefersReducedMotion()) {
    // o rabo balança na prévia
    tailTimer = setInterval(() => {
      frameTail = 1 - frameTail;
      const p = body.querySelector('.pet-portrait');
      const d = body.querySelector('.av-desk');
      if (!p || !d) return;
      const [fn, k] = deskCat(pet, { tail: frameTail });
      mount(p, scaled(catPortrait(pet, { tail: frameTail }), 7));
      mount(d, scaled(workstation(store.get().avatar || {}, fn, k), 4));
    }, 800);
  }
}

// ---------- gatinho no canto da tela ----------

const LINES = ['miau', 'mrrr', 'prrr', '=^.^=', 'miau?', '*ronrona*', 'nyan', 'mrrp!'];
const STUDY = ['estuda mais um nó', 'sudo miau', 'já fez a prova hoje?', 'ping... pong', 'chmod 777 no pote de ração', 'eu vi um 4625 ali'];

export function mountCornerCat() {
  let el = null;
  let frame = { tail: 0, blink: false, happy: false, sleep: false };
  let idleAt = Date.now();
  let timers = [];
  let current = null;

  const pet = () => store.get().pet;

  function draw() {
    if (!el || !pet()) return;
    const c = el.querySelector('.cat-art');
    mount(c, scaled(catPortrait(pet(), frame), 3));
  }

  function bubble(text, ms = 1600) {
    const b = el?.querySelector('.cat-bubble');
    if (!b) return;
    b.textContent = text;
    b.classList.add('is-on');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('is-on'), ms);
  }

  function pat() {
    idleAt = Date.now();
    frame = { ...frame, happy: true, sleep: false, blink: false };
    draw();
    sfx.meow();
    const p = pet();
    const pool = Math.random() < 0.25 ? STUDY : LINES;
    bubble(`${p.name}: ${pool[Math.floor(Math.random() * pool.length)]}`);
    const heart = h('span', { class: 'cat-heart', 'aria-hidden': 'true' }, '♥');
    el.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
    setTimeout(() => { frame = { ...frame, happy: false }; draw(); }, 1300);
  }

  function build() {
    const p = pet();
    const show = p && store.get().settings.petCorner !== false;
    if (!show) { el?.remove(); el = null; current = null; return; }
    const key = JSON.stringify(p);
    if (el && current === key) return;
    current = key;
    if (!el) {
      el = h('div', { class: 'corner-cat' },
        h('span', { class: 'cat-bubble', role: 'status', 'aria-live': 'polite' }),
        h('button', { class: 'cat-art', 'aria-label': `Fazer carinho em ${p.name}`, title: `${p.name} · clique para fazer carinho`, onclick: pat }));
      document.body.appendChild(el);
    }
    el.querySelector('.cat-art').setAttribute('aria-label', `Fazer carinho em ${p.name}`);
    el.querySelector('.cat-art').title = `${p.name} · clique para fazer carinho`;
    draw();
  }

  function tick() {
    if (!el) return;
    const sleepy = Date.now() - idleAt > 60000;
    if (sleepy !== frame.sleep) { frame = { ...frame, sleep: sleepy }; if (sleepy) bubble('zzz', 2200); draw(); }
    if (!frame.sleep && !frame.happy) { frame = { ...frame, tail: 1 - frame.tail }; draw(); }
  }

  function blink() {
    if (!el || frame.sleep || frame.happy) return;
    frame = { ...frame, blink: true }; draw();
    setTimeout(() => { frame = { ...frame, blink: false }; draw(); }, 160);
  }

  const wake = () => { if (frame.sleep) { idleAt = Date.now(); frame = { ...frame, sleep: false }; draw(); } else idleAt = Date.now(); };
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('keydown', wake);

  build();
  store.subscribe(build);
  if (!prefersReducedMotion()) {
    timers.push(setInterval(tick, 900));
    timers.push(setInterval(() => { if (Math.random() < 0.6) blink(); }, 3200));
  }
  return { pat, build };
}
