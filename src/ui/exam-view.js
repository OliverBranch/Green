// Tela da prova de maestria: regras, questões cronometradas e revisão com explicações.

import { h, clear, confirmDialog, trapFocus, mount } from './dom.js';
import { content, LEVELS } from '../content.js';
import * as store from '../state.js';
import { examShape, effectText } from '../skilltree.js';
import { buildExam, beginExam, finishExam } from '../exam.js';
import { log } from './console.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function openExam(nodeId, level, { onClose } = {}) {
  const node = content.nodes.get(nodeId);
  const settings = store.get().settings;
  const shape = examShape(nodeId, level);

  const body = h('div', { class: 'exam-body' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Prova: ${node.name}` },
    h('div', { class: 'overlay-frame exam' }, body));
  document.body.appendChild(overlay);
  document.body.classList.add('has-overlay');
  const releaseTrap = trapFocus(overlay);

  let exam = null;
  let idx = 0;
  let selected = null;
  let timerRaf = 0;
  let deadline = 0;
  let finished = false;

  const onVis = () => { if (document.hidden && exam && !finished) exam.tabSwitches++; };
  const onKey = (e) => {
    if (!exam || finished || e.target.closest('input')) return;
    const item = exam.items[idx];
    const n = item?.order.length || 0;
    const k = e.key.toUpperCase();
    let pick = -1;
    if (/^[1-9]$/.test(k)) pick = Number(k) - 1;
    else if (LETTERS.includes(k)) pick = LETTERS.indexOf(k);
    if (pick >= 0 && pick < n) { e.preventDefault(); choose(pick); }
    if (e.key === 'Enter' && selected != null) { e.preventDefault(); confirmAnswer(); }
  };

  function cleanup() {
    cancelAnimationFrame(timerRaf);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('keydown', onKey);
    releaseTrap();
  }

  function close() {
    cleanup();
    overlay.remove();
    document.body.classList.remove('has-overlay');
    onClose?.();
  }

  // ---- Introdução
  function renderIntro() {
    const pledge = h('input', { type: 'checkbox', id: 'pledge' });
    const start = h('button', { class: 'btn btn-primary', disabled: true, onclick: begin }, 'Começar prova');
    pledge.addEventListener('change', () => { start.disabled = !pledge.checked; });
    const rules = [
      `${shape.size} questões, aprovação com ${shape.need} acertos`,
      settings.timer ? `${settings.timer} segundos por questão; o tempo esgotado conta como erro` : 'sem limite de tempo por questão',
      'sem voltar a uma questão depois de confirmar',
      'as explicações aparecem só no final',
      `se reprovar, nova tentativa em ${settings.cooldownHours} h`,
      'sair ou recarregar a página no meio conta como reprovação',
    ];
    mount(body, 
      h('header', { class: 'exam-head' },
        h('span', { class: 'exam-kicker' }, `${node.branchName} › ${node.code}`),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: close }, '×')),
      h('h1', { class: 'exam-title' }, 'Prova de maestria'),
      h('p', { class: 'exam-sub' }, node.name, ' · nível ', h('b', {}, LEVELS[level].name.toLowerCase()), ` (${LEVELS[level].desc})`),
      h('ul', { class: 'rules' }, rules.map((r) => h('li', {}, r))),
      node.bonus ? h('p', { class: 'exam-reward' }, 'Ao passar: ', h('b', {}, node.bonus.label), ` (${effectText(node.bonus.effect)})`) : null,
      h('label', { class: 'pledge', for: 'pledge' }, pledge, h('span', {}, 'Vou responder sem consultar material, buscador ou IA. O mapa só vale se for honesto.')),
      h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-ghost', onclick: close }, 'Agora não'), start));
    pledge.focus();
  }

  function begin() {
    exam = buildExam(nodeId, level);
    beginExam(exam);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);
    log(`prova iniciada: ${node.code} · ${LEVELS[level].name.toLowerCase()}`, 'info');
    renderQuestion();
  }

  // ---- Questão
  function renderQuestion() {
    selected = null;
    const item = exam.items[idx];
    const q = item.q;
    const timerFill = h('span', { class: 'timer-fill' });
    const timerText = h('span', { class: 'timer-text' });
    const opts = item.order.map((origIdx, i) => h('button', {
      class: 'opt', role: 'radio', 'aria-checked': 'false', 'data-i': String(i),
      onclick: () => choose(i),
    }, h('span', { class: 'opt-key', 'aria-hidden': 'true' }, LETTERS[i]), h('span', { class: 'opt-text' }, q.options[origIdx])));

    const confirmBtn = h('button', { class: 'btn btn-primary', disabled: true, onclick: confirmAnswer },
      idx === exam.items.length - 1 ? 'Confirmar e encerrar' : 'Confirmar resposta');

    mount(body, 
      h('header', { class: 'exam-head' },
        h('span', { class: 'exam-kicker' }, `${node.code} · ${LEVELS[level].name.toLowerCase()}`),
        h('span', { class: 'exam-count' }, `${String(idx + 1).padStart(2, '0')}/${String(exam.items.length).padStart(2, '0')}`),
        h('button', { class: 'btn btn-ghost btn-small', onclick: abandon }, 'Desistir')),
      settings.timer ? h('div', { class: 'timer', role: 'timer', 'aria-label': 'Tempo restante' }, h('span', { class: 'timer-track' }, timerFill), timerText) : null,
      h('div', { class: 'progress-dots', 'aria-hidden': 'true' }, exam.items.map((_, i) => h('span', { class: `dot${i < idx ? ' is-done' : ''}${i === idx ? ' is-now' : ''}` }))),
      h('h2', { class: 'q-prompt', tabindex: '-1' }, q.prompt),
      q.context ? h('pre', { class: 'q-context' }, q.context) : null,
      h('div', { class: 'opts', role: 'radiogroup', 'aria-label': 'Alternativas' }, opts),
      h('div', { class: 'exam-actions' },
        h('span', { class: 'exam-hint' }, 'teclas A–E escolhem · Enter confirma'),
        confirmBtn));

    body.querySelector('.q-prompt').focus();
    body.scrollTop = 0;

    if (settings.timer) {
      deadline = performance.now() + settings.timer * 1000;
      const total = settings.timer * 1000;
      const tick = () => {
        const left = deadline - performance.now();
        if (left <= 0) {
          timerFill.style.transform = 'scaleX(0)';
          timerText.textContent = '0s';
          log(`tempo esgotado na questão ${idx + 1}`, 'warn');
          confirmAnswer(true);
          return;
        }
        timerFill.style.transform = `scaleX(${left / total})`;
        const secs = Math.ceil(left / 1000);
        timerText.textContent = `${secs}s`;
        timerFill.parentElement.parentElement.classList.toggle('is-low', secs <= 15);
        timerRaf = requestAnimationFrame(tick);
      };
      timerRaf = requestAnimationFrame(tick);
    }
  }

  function choose(i) {
    selected = i;
    body.querySelectorAll('.opt').forEach((el) => {
      const on = Number(el.dataset.i) === i;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-checked', String(on));
    });
    const btn = body.querySelector('.exam-actions .btn-primary');
    if (btn) btn.disabled = false;
  }

  function confirmAnswer() {
    cancelAnimationFrame(timerRaf);
    exam.answers[idx] = selected ?? -1;
    idx++;
    if (idx < exam.items.length) renderQuestion();
    else finish();
  }

  async function abandon() {
    const ok = await confirmDialog({
      title: 'Desistir da prova?',
      text: `As questões restantes contam como erro e a prova entra em recarga de ${settings.cooldownHours} h.`,
      ok: 'Desistir', danger: true,
    });
    if (!ok) return;
    cancelAnimationFrame(timerRaf);
    while (exam.answers.length < exam.items.length) exam.answers.push(-1);
    finish();
  }

  // ---- Resultado
  function finish() {
    finished = true;
    cancelAnimationFrame(timerRaf);
    const res = finishExam(exam);
    if (res.passed) log(`[ok] ${node.code} · ${LEVELS[level].name.toLowerCase()} comprovado (${res.correctCount}/${res.total})${res.xpGain ? ` +${res.xpGain} xp` : ''}`, 'ok');
    else log(`[falha] ${node.code} · ${res.correctCount}/${res.total}. recarga de ${settings.cooldownHours} h`, 'alert');
    renderResult(res);
  }

  function renderResult(res) {
    const review = exam.items.map((it, i) => {
      const ans = exam.answers[i];
      const ok = ans === it.correct;
      const yourText = ans >= 0 ? it.q.options[it.order[ans]] : 'sem resposta (tempo esgotado ou desistência)';
      return h('li', { class: `rev${ok ? ' is-ok' : ' is-bad'}` },
        h('div', { class: 'rev-head' },
          h('span', { class: 'rev-mark' }, ok ? 'acerto' : 'erro'),
          h('span', { class: 'rev-n' }, `questão ${i + 1}`)),
        h('p', { class: 'rev-prompt' }, it.q.prompt),
        it.q.context ? h('pre', { class: 'q-context is-small' }, it.q.context) : null,
        !ok ? h('p', { class: 'rev-ans is-bad' }, h('b', {}, 'Sua resposta: '), yourText) : null,
        h('p', { class: 'rev-ans is-ok' }, h('b', {}, ok ? 'Sua resposta: ' : 'Correta: '), it.q.options[it.q.answer]),
        h('p', { class: 'rev-explain' }, it.q.explain));
    });

    const switches = exam.tabSwitches;
    mount(body, 
      h('header', { class: 'exam-head' },
        h('span', { class: 'exam-kicker' }, `${node.code} · ${LEVELS[level].name.toLowerCase()}`),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: close }, '×')),
      h('div', { class: `verdict ${res.passed ? 'is-pass' : 'is-fail'}` },
        h('p', { class: 'verdict-word', 'data-text': res.passed ? 'acesso concedido' : 'acesso negado' }, res.passed ? 'acesso concedido' : 'acesso negado'),
        h('p', { class: 'verdict-score' }, `${res.correctCount} de ${res.total} · mínimo ${exam.need}`),
        res.passed
          ? h('p', { class: 'verdict-note' }, `${node.name}: ${LEVELS[level].name.toLowerCase()} comprovado.`, res.xpGain ? ` +${res.xpGain} XP.` : ' Nível já comprovado antes, sem XP extra.', node.bonus && level === 1 ? ` Bônus ativado: ${node.bonus.label}.` : '')
          : h('p', { class: 'verdict-note' }, `Nova tentativa em ${settings.cooldownHours} h. Leia as explicações abaixo e revise o assunto antes de voltar.`),
        switches ? h('p', { class: 'verdict-warn' }, `Você saiu da aba ${switches} ${switches === 1 ? 'vez' : 'vezes'} durante a prova.`) : null),
      h('h2', { class: 'rev-title' }, 'Revisão'),
      h('ol', { class: 'review' }, review),
      h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', onclick: close }, 'Voltar ao mapa')));
    body.scrollTop = 0;
    body.querySelector('.verdict-word').setAttribute('tabindex', '-1');
    body.querySelector('.verdict-word').focus();
  }

  renderIntro();
}
