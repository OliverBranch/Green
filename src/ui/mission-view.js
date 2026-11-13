// Lista de contratos e execução das missões (Modo Missão: aprendizado guiado com consequência).

import { h, clear, confirmDialog, trapFocus, mount } from './dom.js';
import { content, LEVELS } from '../content.js';
import * as store from '../state.js';
import { startRun, currentStep, optionLock, effectiveCost, choose, advance, submitReport, grade, finalize } from '../mission.js';
import { status } from '../skilltree.js';
import { log } from './console.js';

// ---------- Lista ----------

export function mountMissions(container, { onOpen, onNode }) {
  function render() {
    const s = store.get();
    const rows = content.missions.map((m) => {
      const rec = s.missions[m.id];
      const done = rec?.completions > 0;
      return h('li', { class: 'contract' },
        h('div', { class: 'contract-main' },
          h('div', { class: 'contract-meta' },
            h('span', { class: 'contract-id' }, m.id.toUpperCase()),
            h('span', {}, m.kind),
            h('span', { class: 'contract-diff', 'aria-label': `Dificuldade ${m.difficulty} de 3` }, '▮'.repeat(m.difficulty) + '▯'.repeat(3 - m.difficulty))),
          h('h3', { class: 'contract-title' }, m.title),
          h('p', { class: 'contract-client' }, m.client),
          h('p', { class: 'contract-sum' }, m.summary),
          m.related?.length ? h('p', { class: 'contract-rel' }, 'Nós que ajudam: ',
            m.related.map((id, i) => {
              const n = content.nodes.get(id);
              if (!n) return null;
              const st = status(n);
              return [i ? ', ' : '', h('button', { class: `link-btn is-${st.key}`, onclick: () => onNode(id) }, n.short)];
            })) : null),
        h('div', { class: 'contract-side' },
          done ? h('p', { class: 'contract-best' }, `Melhor relatório: nota ${grade(rec.best)}`) : h('p', { class: 'contract-best is-dim' }, 'Ainda não concluída'),
          h('button', { class: 'btn btn-primary', onclick: () => onOpen(m.id) }, done ? 'Jogar de novo' : 'Aceitar contrato')));
    });
    const upcoming = content.upcoming.map((u) => h('li', { class: 'contract is-upcoming' },
      h('div', { class: 'contract-main' },
        h('div', { class: 'contract-meta' }, h('span', { class: 'contract-id' }, '···'), h('span', {}, u.kind)),
        h('h3', { class: 'contract-title' }, u.title),
        h('p', { class: 'contract-sum' }, 'Contrato em negociação. Chega numa próxima versão.'))));

    mount(container, h('div', { class: 'page' },
      h('header', { class: 'page-head' },
        h('h1', { class: 'page-title' }, 'Contratos'),
        h('p', { class: 'page-lead' }, 'Missões são onde você aprende: cada escolha gasta energia, pode gerar ruído e recebe explicação na hora. Errar custa, mas ensina. Nós comprovados no mapa liberam opções novas e barateiam ações.')),
      h('ul', { class: 'contracts' }, rows, upcoming)));
  }
  render();
  return { destroy: store.subscribe(render) };
}

// ---------- Execução ----------

function meter(label, value, max, cls) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return h('div', { class: `meter ${cls}` },
    h('div', { class: 'meter-top' }, h('span', {}, label), h('b', {}, `${Math.round(value)}`)),
    h('div', { class: 'meter-track', role: 'meter', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(Math.round(value)) },
      h('span', { class: 'meter-fill', style: { width: `${pct}%` } })));
}

export function openMission(missionId, { onClose, onNode } = {}) {
  const mission = content.missions.find((m) => m.id === missionId);
  const run = startRun(mission);
  const main = h('div', { class: 'run-main' });
  const side = h('aside', { class: 'run-side', 'aria-label': 'Recursos e escopo' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Missão: ${mission.title}` },
    h('div', { class: 'overlay-frame run' },
      h('header', { class: 'run-head' },
        h('span', { class: 'exam-kicker' }, `${mission.id.toUpperCase()} · ${mission.kind}`),
        h('h1', { class: 'run-title' }, mission.title),
        h('button', { class: 'btn btn-ghost btn-small', onclick: quit }, 'Sair')),
      h('div', { class: 'run-grid' }, main, side)));
  document.body.appendChild(overlay);
  document.body.classList.add('has-overlay');
  const releaseTrap = trapFocus(overlay);
  log(`contrato aceito: ${mission.title}`, 'info');

  let feedback = null; // { opt, res }
  let scopeOpen = !window.matchMedia('(max-width: 820px)').matches;
  let finalized = null;

  function close() {
    releaseTrap();
    overlay.remove();
    document.body.classList.remove('has-overlay');
    onClose?.();
  }

  async function quit() {
    if (run.status !== 'running') return close();
    const ok = await confirmDialog({ title: 'Abandonar o contrato?', text: 'O progresso desta tentativa se perde. Penalidades de reputação já aplicadas permanecem.', ok: 'Abandonar', danger: true });
    if (!ok) return;
    run.status = 'failed';
    run.failReason = 'quit';
    finalize(run);
    log(`contrato abandonado: ${mission.title}`, 'warn');
    close();
  }

  function renderSide() {
    const repCls = run.rep > 0 ? 'is-up' : run.rep < 0 ? 'is-down' : '';
    mount(side, 
      meter('energia', run.energy, run.maxEnergy, 'is-energy'),
      meter('ruído', run.noise, 100, `is-noise${run.noise >= 70 ? ' is-hot' : ''}`),
      h('div', { class: 'side-row' }, h('span', {}, 'reputação'), h('b', { class: repCls }, `${run.rep > 0 ? '+' : ''}${run.rep}`)),
      h('div', { class: 'side-row' }, h('span', {}, 'xp da missão'), h('b', {}, String(run.xp))),
      h('details', { class: 'scope', open: scopeOpen ? '' : null, ontoggle: (e) => { scopeOpen = e.currentTarget.open; } },
        h('summary', {}, 'Regras de engajamento'),
        h('h3', {}, 'No escopo'),
        h('ul', {}, mission.scope.in.map((t) => h('li', { class: 'is-in' }, t))),
        h('h3', {}, 'Fora do escopo'),
        h('ul', {}, mission.scope.out.map((t) => h('li', { class: 'is-out' }, t)))),
      run.transcript.length ? h('section', { class: 'trail' },
        h('h3', {}, 'Rastro'),
        h('ol', {}, run.transcript.map((t) => h('li', { class: `is-${t.outcome}` }, h('span', { class: 'trail-step' }, t.title), t.label)))) : null);
  }

  function costLine(opt) {
    const c = effectiveCost(opt);
    const parts = [];
    const fmt = (label, val, base) => (val !== base
      ? h('span', { class: 'cost is-reduced' }, `${label} `, h('s', {}, String(base)), ` ${val}`)
      : h('span', { class: 'cost' }, `${label} ${val}`));
    parts.push(fmt('energia', c.energy, c.base.energy));
    if (c.base.noise) parts.push(fmt('ruído +', c.noise, c.base.noise));
    return h('span', { class: 'opt-cost' }, parts);
  }

  function renderStep() {
    const step = currentStep(run);
    const nodes = [];
    nodes.push(h('p', { class: 'step-n' }, `etapa ${run.step + 1} de ${mission.steps.length}`));
    nodes.push(h('h2', { class: 'step-title', tabindex: '-1' }, step.title));
    for (const p of step.text || []) nodes.push(h('p', { class: 'step-text' }, p));
    if (step.context) nodes.push(h('pre', { class: 'q-context' }, step.context));

    if (step.type === 'briefing') {
      nodes.push(h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', onclick: () => { advance(run); render(); } }, step.cta || 'Continuar')));
    } else if (step.type === 'choice') {
      const tried = run.chosen[run.step] || [];
      const list = step.options.map((opt) => {
        const lock = optionLock(opt);
        const used = tried.includes(opt.id);
        const isFb = feedback?.opt.id === opt.id;
        const disabled = !!lock || used || (feedback && feedback.res.advance);
        const btn = h('button', {
          class: `choice${lock ? ' is-locked' : ''}${used ? ` was-${opt.outcome}` : ''}${isFb ? ' is-current' : ''}`,
          disabled, onclick: () => pick(opt),
        },
          h('span', { class: 'choice-label' }, opt.label),
          lock
            ? h('span', { class: 'choice-lock' }, 'requer ', h('b', {}, lock.node?.short || '?'), ` · ${LEVELS[lock.level].name.toLowerCase()}`)
            : costLine(opt));
        const item = h('li', {}, btn);
        if (lock) {
          item.appendChild(h('button', { class: 'link-btn choice-why', onclick: () => onNode?.(opt.requires.node) }, 'ver nó no mapa'));
        }
        if (isFb) item.appendChild(feedbackBlock(opt, feedback.res));
        return item;
      });
      nodes.push(h('ul', { class: 'choices' }, list));
      if (feedback?.res.advance) {
        nodes.push(h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', id: 'next-step', onclick: () => { feedback = null; advance(run); render(); } }, 'Continuar')));
      }
    } else if (step.type === 'report') {
      const boxes = step.items.map((it) => h('li', {}, h('label', { class: 'check' },
        h('input', { type: 'checkbox', value: it.id }), h('span', {}, it.label))));
      nodes.push(h('ul', { class: 'checks' }, boxes));
      nodes.push(h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', onclick: () => {
        const sel = [...main.querySelectorAll('.checks input:checked')].map((i) => i.value);
        submitReport(run, sel);
        render();
      } }, 'Enviar relatório')));
    }
    return nodes;
  }

  function feedbackBlock(opt, res) {
    const word = { good: 'boa decisão', ok: 'aceitável', bad: 'má decisão' }[opt.outcome];
    return h('div', { class: `fb is-${opt.outcome}`, role: 'status' },
      h('p', { class: 'fb-head' }, h('b', {}, word), res.xp ? ` · +${res.xp} xp` : '', opt.rep ? ` · reputação ${opt.rep > 0 ? '+' : ''}${opt.rep}` : ''),
      h('p', {}, opt.feedback),
      opt.outcome === 'bad' ? h('p', { class: 'fb-retry' }, 'Escolha outra opção.') : null);
  }

  function pick(opt) {
    const res = choose(run, opt);
    feedback = { opt, res };
    if (opt.outcome === 'bad') log(`missão: decisão ruim em "${currentStep(run).title}"`, 'warn');
    render();
    const next = main.querySelector('#next-step');
    (next || main.querySelector('.fb'))?.focus?.();
  }

  function renderEnd() {
    if (!finalized) {
      finalized = finalize(run);
      if (run.status === 'done') log(`[ok] contrato concluído: ${mission.title} · nota ${grade(run.report.score)} · +${finalized.xp} xp`, 'ok');
      else log(`[falha] contrato perdido: ${mission.title}`, 'alert');
    }
    const nodes = [];
    if (run.status === 'failed') {
      const why = run.failReason === 'noise'
        ? 'O SOC do cliente percebeu sua atividade e bloqueou seu IP. Ruído demais em pouco tempo encerra qualquer contrato.'
        : 'A energia acabou: o tempo do contrato terminou antes do relatório.';
      nodes.push(h('div', { class: 'verdict is-fail' },
        h('p', { class: 'verdict-word', 'data-text': 'contrato perdido' }, 'contrato perdido'),
        h('p', { class: 'verdict-note' }, why)));
    } else {
      const r = run.report;
      const step = mission.steps[mission.steps.length - 1];
      nodes.push(h('div', { class: 'verdict is-pass' },
        h('p', { class: 'verdict-word', 'data-text': `nota ${grade(r.score)}` }, `nota ${grade(r.score)}`),
        h('p', { class: 'verdict-score' }, `${r.hits} de ${r.total} achados corretos${r.wrong ? ` · ${r.wrong} achado(s) indevido(s)` : ''}`),
        h('p', { class: 'verdict-note' }, `+${finalized.xp} XP`, finalized.first ? '' : ' (repetição vale 25%)', finalized.xpMul > 1 ? `, já com +${Math.round((finalized.xpMul - 1) * 100)}% de bônus` : '', `. Pico de ruído: ${run.peakNoise}.`)));
      nodes.push(h('h2', { class: 'rev-title' }, 'Gabarito do relatório'));
      nodes.push(h('ul', { class: 'review' }, step.items.map((it) => {
        const sel = r.selected.includes(it.id);
        const right = sel === it.correct;
        return h('li', { class: `rev${right ? ' is-ok' : ' is-bad'}` },
          h('p', { class: 'rev-prompt' }, it.label),
          h('p', { class: 'rev-explain' }, it.correct ? (sel ? 'Incluído, correto.' : 'Faltou incluir: é um achado real.') : (sel ? `Incluído por engano. ${it.why || ''}` : `Ficou de fora, correto. ${it.why || ''}`)));
      })));
    }
    if (mission.related?.length) {
      nodes.push(h('h2', { class: 'rev-title' }, 'Comprove o que praticou'));
      nodes.push(h('p', { class: 'step-text' }, 'Estes nós cobrem o conteúdo da missão. Comprová-los libera as opções bloqueadas na próxima vez.'));
      nodes.push(h('ul', { class: 'rel-nodes' }, mission.related.map((id) => {
        const n = content.nodes.get(id);
        const st = status(n);
        return h('li', {}, h('button', { class: `link-btn is-${st.key}`, onclick: () => { close(); onNode?.(id); } }, `${n.code} · ${n.name}`), h('span', { class: `chip is-${st.key}` }, st.label));
      })));
    }
    nodes.push(h('div', { class: 'exam-actions' }, h('button', { class: 'btn btn-primary', onclick: close }, 'Voltar aos contratos')));
    return nodes;
  }

  function render() {
    renderSide();
    mount(main, ...(run.status === 'running' ? renderStep() : renderEnd()));
    if (!feedback) { main.scrollTop = 0; main.querySelector('.step-title, .verdict-word')?.focus?.(); }
  }

  render();
}
