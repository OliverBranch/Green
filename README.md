# GREEN · terminal de estudo

RPG de navegador para estudar segurança da informação. A árvore de habilidades espelha o que você realmente sabe: um nó só acende quando você passa na prova, sem consulta, com tempo contado e recarga se reprovar.

Versão 0.1.

## Como jogar

- **Mapa**: 9 ramos e 30 nós, baseados no conteúdo programático de Segurança da Informação. Os nós do anel interno estão disponíveis desde o início.
- **Prova de maestria**: 4 questões, aprovação com 3, 90 s por questão (ajustável). Explicações só no final. Reprovar coloca o nó em recarga (24 h por padrão). Sair ou recarregar a página no meio conta como reprovação.
- **Níveis**: cada nó tem Conhecimento, Aplicação e Domínio. Na 0.1, todos os nós de entrada têm os dois primeiros níveis; PKI, TLS e Perímetro têm o primeiro.
- **Contratos (missões)**: aprendizado guiado. Cada escolha gasta energia e pode gerar ruído; a explicação aparece na hora. Nós comprovados liberam opções e reduzem custos.
- **Terminal**: tecla `` ` `` ou botão no rodapé. Digite `help`.

## Rodar localmente

Os arquivos de conteúdo são carregados com `fetch`, que não funciona abrindo o `index.html` direto do disco. Use um servidor simples na pasta do projeto:

```bash
python -m http.server 8000
# abra http://localhost:8000
```

## Publicar no GitHub Pages

1. Crie um repositório e envie todos os arquivos desta pasta (inclusive o `.nojekyll`).
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O jogo fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Os caminhos são relativos, então funciona em qualquer subpasta. Repositório público no plano gratuito: as respostas das provas ficam visíveis em `content/exams/`. É um jogo para você, então o acordo de honestidade é com você mesmo.

## Save

O progresso fica no `localStorage` do navegador, atrelado ao domínio. Use **Perfil → Exportar save** de vez em quando; limpar os dados do navegador apaga o progresso. O save tem campo de versão para que mudanças futuras não quebrem o que você já conquistou.

## Estrutura

```
index.html
assets/
  css/main.css          estilo (tema de fósforo, responsivo)
  favicon.svg
src/
  main.js               inicialização
  state.js              estado e persistência (único lugar que toca o localStorage)
  content.js            carga e validação do conteúdo
  skilltree.js          regras da árvore, bônus e cargos
  exam.js               motor das provas
  mission.js            motor das missões
  ui/                   telas (boot, mapa, prova, missão, perfil, terminal)
content/
  manifest.json         lista de arquivos de conteúdo
  tree.json             ramos e nós
  exams/*.json          questões por ramo
  missions/*.json       contratos
```

## Adicionar conteúdo

Nada no motor precisa mudar. Inclua o arquivo em `content/manifest.json` se for novo.

**Questão** (em `content/exams/<ramo>.json`):

```json
{
  "id": "cri-pki-2-01",
  "node": "cri-pki",
  "level": 2,
  "prompt": "Enunciado",
  "context": "opcional: log, código ou saída de comando",
  "options": ["correta", "distrator", "distrator", "distrator"],
  "answer": 0,
  "explain": "Por que a correta está certa e onde os distratores erram."
}
```

As alternativas são embaralhadas a cada prova. Um nível só abre para prova com pelo menos 3 questões no banco; com 6 ou mais, as provas variam entre tentativas.

**Nó** (em `content/tree.json`): `id`, `code` (até 4 letras), `short`, `name`, `ring` (1 a 3), `offset` (posição lateral no setor, de -1 a 1), `requires`, `summary` e `bonus`. Tipos de bônus: `costReduction` e `noiseReduction` (com `tag`), `xpBonus` e `unlock` (para opções de missão com `requires`).

O console do navegador lista qualquer problema de validação ao carregar.
