// Console inferior: log de eventos e comandos de texto.

import { h, clear, mount } from './dom.js';
import * as store from '../state.js';

const buffer = [];
let out = null;
let lastLine = null;
let commands = {};

function stamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function renderLine(entry) {
  return h('div', { class: `con-line is-${entry.kind}` },
    h('span', { class: 'con-time' }, entry.time), ' ', entry.text);
}

export function log(text, kind = 'info') {
  const entry = { text, kind, time: stamp() };
  buffer.push(entry);
  if (buffer.length > 200) buffer.shift();
  if (out) {
    out.appendChild(renderLine(entry));
    while (out.childElementCount > 200) out.firstChild.remove();
    out.scrollTop = out.scrollHeight;
  }
  if (lastLine) { mount(lastLine, renderLine(entry)); }
}

export function mountConsole(container, cmds) {
  commands = cmds;
  const prompt = () => `${store.get().operator || 'operador'}@green:~$`;
  const promptEl = h('span', { class: 'con-prompt', 'aria-hidden': 'true' }, prompt());
  const input = h('input', {
    class: 'con-input', type: 'text', autocomplete: 'off', spellcheck: 'false',
    'aria-label': 'Comando do terminal', placeholder: 'digite help',
  });
  out = h('div', { class: 'con-out', role: 'log', 'aria-live': 'polite' });
  lastLine = h('div', { class: 'con-last' });
  const toggle = h('button', { class: 'con-toggle', 'aria-expanded': 'false', 'aria-controls': 'console-body' }, 'terminal');
  const body = h('div', { class: 'con-body', id: 'console-body' }, out,
    h('form', { class: 'con-form', onsubmit: (e) => { e.preventDefault(); run(input.value); input.value = ''; } }, promptEl, input));

  const history = [];
  let hIdx = 0;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) { hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx] || ''; e.preventDefault(); }
    if (e.key === 'ArrowDown' && history.length) { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; e.preventDefault(); }
  });

  function setOpen(open) {
    container.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) { out.scrollTop = out.scrollHeight; input.focus(); }
  }
  toggle.addEventListener('click', () => setOpen(!container.classList.contains('is-open')));
  window.addEventListener('keydown', (e) => {
    if (e.key === '`' && !e.target.closest('input, textarea')) { e.preventDefault(); setOpen(!container.classList.contains('is-open')); }
  });

  function run(raw) {
    const line = raw.trim();
    if (!line) return;
    history.push(line); hIdx = history.length;
    out.appendChild(h('div', { class: 'con-line is-cmd' }, h('span', { class: 'con-time' }, stamp()), ' ', `$ ${line}`));
    const [name, ...args] = line.split(/\s+/);
    const fn = commands[name.toLowerCase()];
    if (fn) {
      try { fn(args, { print: (t, k = 'info') => log(t, k), setOpen }); }
      catch (err) { log(`erro: ${err.message}`, 'alert'); }
    } else {
      log(`comando não encontrado: ${name}. digite help`, 'warn');
    }
    promptEl.textContent = prompt();
  }

  mount(container, h('div', { class: 'con-bar' }, toggle, lastLine), body);
  for (const entry of buffer) out.appendChild(renderLine(entry));
  if (buffer.length) mount(lastLine, renderLine(buffer[buffer.length - 1]));
  store.subscribe(() => { promptEl.textContent = prompt(); });
  return { setOpen };
}
