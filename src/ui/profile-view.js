// Perfil do operador: progresso real por área, ajustes e gestão do save.

import { h, clear, confirmDialog, mount } from './dom.js';
import { content } from '../content.js';
import * as store from '../state.js';
import { rank, mastery, branchMastery, activeEffects, effectText } from '../skilltree.js';
import { log } from './console.js';
import { sheet, playerAttrs } from './run-view.js';
import { portrait as avatarPortrait, workstation, scaled } from './avatar.js';
import { openAvatarEditor } from './avatar-view.js';

function select(label, value, options, onChange) {
  const id = `set-${label.replace(/\W+/g, '-')}`;
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('select', { id, onchange: (e) => onChange(Number(e.target.value)) },
      options.map(([v, t]) => h('option', { value: String(v), selected: v === value ? 'selected' : null }, t))));
}

export function mountProfile(container, { onNode }) {
  function render() {
    const s = store.get();
    const r = rank(s.xp);
    const m = mastery();
    const exams = s.history.filter((x) => !x.kind);
    const answered = exams.length;
    const right = exams.filter((x) => x.ok).length;
    const effects = activeEffects();

    const branchRows = content.branches.map((b) => {
      const bm = branchMastery(b);
      return h('li', { class: 'area' },
        h('span', { class: 'area-name' }, b.name),
        h('span', { class: 'area-bar', 'aria-hidden': 'true' },
          b.nodes.map((n) => {
            const lv = s.nodes[n.id]?.level || 0;
            return h('button', { class: 'area-node', title: n.name, tabindex: '-1', onclick: () => onNode(n.id) },
              [1, 2, 3].map((i) => h('span', { class: `seg${lv >= i ? ' is-lit' : ''}` })));
          })),
        h('span', { class: 'area-num' }, `${bm.proven}/${bm.total}`));
    });

    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        store.importSave(await file.text());
        log(`save importado: ${file.name}`, 'ok');
      } catch (err) {
        log(`falha ao importar: ${err.message}`, 'alert');
        alertBox.textContent = `Não foi possível importar: ${err.message}`;
      }
    });
    const alertBox = h('p', { class: 'field-error', role: 'alert' });

    mount(container, h('div', { class: 'page' },
      h('header', { class: 'page-head profile-head' },
        h('div', {},
          h('p', { class: 'profile-handle' }, `${s.operator}@green`),
          h('h1', { class: 'page-title' }, r.name),
          h('div', { class: 'xpbar', role: 'meter', 'aria-label': 'XP até o próximo cargo', 'aria-valuenow': String(s.xp) },
            h('span', { class: 'xpbar-fill', style: { width: `${Math.round(r.progress * 100)}%` } })),
          h('p', { class: 'profile-xp' }, `${s.xp} XP`, r.ceil ? ` · ${r.ceil - s.xp} até ${r.nextName.toLowerCase()}` : ' · cargo máximo')),
        h('div', { class: 'profile-mastery' },
          h('p', { class: 'mastery-num' }, `${m.proven}`, h('span', {}, `/${m.total}`)),
          h('p', { class: 'mastery-cap' }, 'níveis comprovados'))),

      h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Domínio por área'),
        h('p', { class: 'sec-lead' }, 'Cada traço é um nível comprovado em prova. XP mede atividade; este quadro mede o que você sabe.'),
        h('ul', { class: 'areas' }, branchRows)),

      h('section', { class: 'sec prof-avatar' },
        s.avatar
          ? h('div', { class: 'prof-av-art' }, scaled(avatarPortrait(s.avatar), 4), scaled(workstation(s.avatar), 3))
          : h('p', { class: 'sec-lead' }, 'Você ainda não criou seu personagem. Ele aparece na estação de trabalho durante os combates.'),
        h('div', {},
          h('h2', { class: 'sec-title' }, 'Personagem'),
          h('p', { class: 'sec-lead' }, 'Seu analista na estação de trabalho do SOC: corpo, pele, cabelo, rosto, roupa e acessórios.'),
          h('button', { class: 'btn', onclick: () => openAvatarEditor({ first: !s.avatar }) }, s.avatar ? 'Editar personagem' : 'Criar personagem'))),

      h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Ficha do analista'),
        h('p', { class: 'sec-lead' }, 'O que você comprova em cada área vira atributo de combate na operação. Ramos fortes, analista forte.'),
        sheet(playerAttrs())),

      h('section', { class: 'sec sec-split' },
        h('div', {},
          h('h2', { class: 'sec-title' }, 'Registro'),
          h('dl', { class: 'stats' },
            h('dt', {}, 'provas feitas'), h('dd', {}, String(s.stats.exams)),
            h('dt', {}, 'aprovações'), h('dd', {}, String(s.stats.passed)),
            h('dt', {}, 'acerto nas provas'), h('dd', {}, answered ? `${Math.round((right / answered) * 100)}% de ${answered}` : '—'),
            h('dt', {}, 'acerto nas cartas'), h('dd', {}, s.stats.cards ? `${Math.round(((s.stats.cardsOk || 0) / s.stats.cards) * 100)}% de ${s.stats.cards}` : '—'),
            h('dt', {}, 'operações vencidas'), h('dd', {}, `${s.stats.runsWon || 0}/${s.stats.runs || 0}`),
            h('dt', {}, 'contratos concluídos'), h('dd', {}, String(s.stats.missions)),
            h('dt', {}, 'contratos perdidos'), h('dd', {}, String(s.stats.missionsFailed)),
            h('dt', {}, 'reputação'), h('dd', {}, `${s.reputation}/100`))),
        h('div', {},
          h('h2', { class: 'sec-title' }, 'Bônus ativos'),
          effects.length
            ? h('ul', { class: 'effects' }, effects.map((e) => h('li', {}, h('b', {}, `${e.node.code} · ${e.node.bonus.label}`), h('span', {}, `${effectText(e.effect)} (nível ${e.level})`))))
            : h('p', { class: 'sec-lead' }, 'Nenhum ainda. Passe numa prova para ativar o bônus do nó.'))),

      h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Ajustes'),
        h('div', { class: 'fields' },
          select('Tempo por questão', s.settings.timer, [[60, '60 segundos'], [90, '90 segundos'], [120, '120 segundos'], [0, 'sem limite']],
            (v) => store.update((st) => { st.settings.timer = v; })),
          select('Recarga após reprovar', s.settings.cooldownHours, [[1, '1 hora'], [12, '12 horas'], [24, '24 horas']],
            (v) => store.update((st) => { st.settings.cooldownHours = v; })),
          h('div', { class: 'field' },
            h('label', { class: 'check', for: 'fx' },
              h('input', { type: 'checkbox', id: 'fx', checked: s.settings.effects, onchange: (e) => store.update((st) => { st.settings.effects = e.target.checked; }) }),
              h('span', {}, 'Efeitos de monitor CRT (linhas de varredura e brilho)'))))),

      h('section', { class: 'sec' },
        h('h2', { class: 'sec-title' }, 'Save'),
        h('p', { class: 'sec-lead' }, 'O progresso fica neste navegador. Exporte de vez em quando: limpar os dados do navegador apaga o save.'),
        h('div', { class: 'save-actions' },
          h('button', { class: 'btn btn-primary', onclick: () => { store.exportSave(); log('save exportado', 'ok'); } }, 'Exportar save'),
          h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } } }, 'Importar save'),
          fileInput,
          h('button', { class: 'btn btn-danger', onclick: async () => {
            const ok = await confirmDialog({ title: 'Apagar todo o progresso?', text: 'Nós comprovados, XP, reputação e histórico serão apagados deste navegador. Exporte antes se quiser guardar.', ok: 'Apagar tudo', danger: true });
            if (!ok) return;
            const op = s.operator;
            store.reset();
            store.update((st) => { st.operator = op; });
            log('progresso apagado', 'warn');
          } }, 'Apagar progresso')),
        alertBox),

      h('p', { class: 'about' }, `GREEN ${content.version} · ${content.nodes.size} nós · ${content.totalQuestions} questões · ${content.missions.length} missão`)));
  }
  render();
  return { destroy: store.subscribe(render) };
}
