// Sequência de boot e identificação do operador.

import { h, clear, prefersReducedMotion } from './dom.js';

const LOGO = [
  ' ██████╗ ██████╗ ███████╗███████╗███╗   ██╗',
  '██╔════╝ ██╔══██╗██╔════╝██╔════╝████╗  ██║',
  '██║  ███╗██████╔╝█████╗  █████╗  ██╔██╗ ██║',
  '██║   ██║██╔══██╗██╔══╝  ██╔══╝  ██║╚██╗██║',
  '╚██████╔╝██║  ██║███████╗███████╗██║ ╚████║',
  ' ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝',
].join('\n');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runBoot(root, { returning, load }) {
  clear(root);
  const lines = h('div', { class: 'boot-lines', 'aria-live': 'polite' });
  const screen = h('div', { class: 'boot' },
    h('pre', { class: 'boot-logo', 'aria-label': 'GREEN' }, LOGO),
    h('p', { class: 'boot-sub' }, 'terminal de estudo · segurança da informação'),
    lines,
    h('p', { class: 'boot-skip' }, 'qualquer tecla para pular'));
  root.appendChild(screen);

  let fast = returning || prefersReducedMotion();
  const skip = () => { fast = true; };
  window.addEventListener('keydown', skip, { once: true });
  screen.addEventListener('click', skip, { once: true });

  const print = async (tag, text, cls = '') => {
    lines.appendChild(h('div', { class: `boot-line ${cls}` }, h('span', { class: 'boot-tag' }, tag), ' ', text));
    if (!fast) await wait(90 + Math.random() * 140);
  };

  await print('[ boot ]', 'GREEN/OS 0.1 · kernel seginfo');
  await print('[  ok  ]', 'montando /dev/conhecimento');
  let content;
  try {
    content = await load(async (what, detail) => { await print('[  ok  ]', `${what}: ${detail}`); });
  } catch (err) {
    await print('[ erro ]', err.message, 'is-alert');
    await print('[ dica ]', 'abra o jogo por um servidor HTTP (GitHub Pages ou python -m http.server).', 'is-warn');
    throw err;
  }
  if (content.warnings.length) await print('[ aviso]', `${content.warnings.length} problema(s) no conteúdo; detalhes no console do navegador`, 'is-warn');
  await print('[  ok  ]', 'verificando integridade do save');
  await print('[ info ]', 'nenhum bônus é concedido sem prova', 'is-dim');
  await wait(fast ? 120 : 500);
  window.removeEventListener('keydown', skip);
  return content;
}

export function askOperator(root) {
  return new Promise((resolve) => {
    const input = h('input', {
      class: 'login-input', id: 'codename', type: 'text', maxlength: '20', autocomplete: 'off',
      spellcheck: 'false', 'aria-describedby': 'codename-hint', placeholder: 'ex.: oliver',
    });
    const err = h('p', { class: 'login-error', role: 'alert' });
    const form = h('form', { class: 'login', onsubmit: (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!/^[\p{L}\p{N}_.-]{2,20}$/u.test(v)) {
        err.textContent = 'Use de 2 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.';
        input.focus();
        return;
      }
      resolve(v);
    } },
      h('label', { class: 'login-label', for: 'codename' }, 'Identifique-se, operador.'),
      h('div', { class: 'login-row' },
        h('span', { class: 'login-prompt', 'aria-hidden': 'true' }, 'login:'),
        input,
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Entrar')),
      h('p', { class: 'login-hint', id: 'codename-hint' }, 'Esse codinome aparece no terminal e no arquivo de save.'),
      err);
    const boot = root.querySelector('.boot');
    boot.querySelector('.boot-skip')?.remove();
    boot.appendChild(form);
    input.focus();
  });
}
