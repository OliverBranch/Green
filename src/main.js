// Ponto de entrada.

import * as store from './state.js';
import { loadContent, LEVELS } from './content.js';
import { settleAbandoned } from './exam.js';
import { runBoot, askOperator } from './ui/boot.js';
import { mountShell, applyFx } from './ui/shell.js';
import { log } from './ui/console.js';

async function start() {
  const root = document.getElementById('app');
  const state = store.load();
  applyFx();

  let content;
  try {
    content = await runBoot(root, { returning: !!state.operator, load: loadContent });
  } catch (err) {
    console.error(err);
    return;
  }

  if (!state.operator) {
    const name = await askOperator(root);
    store.update((s) => { s.operator = name; });
  }

  const abandoned = settleAbandoned();

  mountShell(root);
  const s = store.get();
  log(`sessão iniciada · bem-vindo, ${s.operator}`, 'ok');
  if (abandoned) log(`prova de ${abandoned.node?.code} (${LEVELS[abandoned.level].name.toLowerCase()}) foi interrompida e contou como reprovação`, 'alert');
  if (!s.stats.exams) log('dica: clique num nó do anel interno do mapa para fazer sua primeira prova. ` abre este terminal.', 'info');
  if (content.warnings.length) log(`${content.warnings.length} aviso(s) de conteúdo; veja o console do navegador`, 'warn');
}

start();
