// Utilitários de DOM, sem dependências.

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

function setProps(el, props, isSvg) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled')) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  setProps(el, props, false);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, props = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  setProps(el, props, true);
  append(el, children);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// Limpa e preenche, ignorando null/false (o append nativo os converteria em texto).
export function mount(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

export function duration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (hh) return `${hh}h ${String(mm).padStart(2, '0')}min`;
  if (mm) return `${mm}min ${String(ss).padStart(2, '0')}s`;
  return `${ss}s`;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Diálogo de confirmação próprio (os nativos travam a página e quebram a estética).
export function confirmDialog({ title, text, ok = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const close = (val) => { wrap.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const okBtn = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) }, ok);
    const wrap = h('div', { class: 'dialog-wrap', onclick: (e) => { if (e.target === wrap) close(false); } },
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
        h('h2', { id: 'dlg-title', class: 'dialog-title' }, title),
        h('p', { class: 'dialog-text' }, text),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn btn-ghost', onclick: () => close(false) }, cancel),
          okBtn)));
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

export function trapFocus(container) {
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
