# GREEN · terminal de estudo

RPG de navegador para estudar segurança da informação. A árvore de habilidades espelha o que você realmente sabe: um nó só acende quando você passa na prova, sem consulta, com tempo contado e recarga se reprovar.

Versão 0.4: **combate por cartas**. Na Operação (o modo roguelike), cada ação abre uma carta de conhecimento: acertou, a ação acontece. E o que você estuda vira atributo do seu analista.

## Como jogar

- **Habilidades (mapa)**: 9 ramos e 30 nós, baseados no conteúdo programático de Segurança da Informação. Os nós do anel interno estão disponíveis desde o início.
- **Prova de maestria**: 4 questões, aprovação com 3, 90 s por questão (ajustável). Explicações só no final. Reprovar coloca o nó em recarga (24 h por padrão). Sair ou recarregar a página no meio conta como reprovação.
- **Níveis**: cada nó tem Conhecimento, Aplicação e Domínio.
- **Contratos (missões)**: aprendizado guiado. Cada escolha gasta energia e pode gerar ruído; a explicação aparece na hora.
- **Operação**: veja abaixo.
- **Terminal**: tecla `` ` `` ou botão no rodapé. Digite `help` (`ficha` mostra seus atributos).
- **Personagem**: na primeira vez o jogo abre o criador do seu analista: corpo, tom de pele, cabelo (8 estilos e 10 cores), barba, óculos, roupa e cor, capuz, fone e boné. Ele aparece de costas na estação de trabalho durante os combates, no cartão do menu e no perfil. Para mudar: Perfil → Editar personagem, o link no menu ou o comando `personagem`.
- **Gato**: todo analista tem um. Depois do personagem, o jogo oferece a adoção: nome, cor do pelo, padrão (sólido, listrado, manchado, frajola, siamês, tricolor) e cor secundária, cor dos olhos, heterocromia, vesgo, expressão, tamanho, orelhas, rabo e coleira, sino, gravata ou bandana. Ele fica sentado na sua mesa durante os combates (balança o rabo, pisca e comemora as vitórias) e mora no canto da tela: clique para fazer carinho; parado por um minuto, ele dorme. Para mudar: Perfil, o link no menu ou o comando `gato`. O comando `miau` também funciona. Dá para esconder o gato do canto em Perfil → Ajustes.
- **Menu lateral**: Operação é a aba inicial. Cada seção mostra o que tem para fazer (operação em andamento, provas disponíveis) e o rodapé do menu traz sua ficha do analista. Alt+1 a Alt+4 trocam de seção.

## Operação (roguelike)

Uma operação tem **3 atos**. Cada ato é um mapa de 8 andares com caminhos que se cruzam, gerado na hora, e um **chefe** no topo (sorteado entre dois por ato). Você escolhe a rota:

| Nó | O que acontece |
| --- | --- |
| Incidente | Combate contra um atacante comum. Créditos e às vezes um script. |
| Elite | Atacante com **mutadores** (blindado, veloz, furtivo, regenerativo, brutal, polimórfico, numeroso). Rende uma ferramenta. |
| Imprevisto | Situação inesperada com escolhas. Várias são **testes de conhecimento** com questões reais do banco de provas. |
| Plantão | Dormir (cura) ou estudar (questão de prova puxada dos temas que você mais errou; acertar aumenta a integridade máxima e limpa ferrugem). |
| Mercado | Ferramentas, scripts, manutenção e reciclagem de ferrugem. |
| Achado | Uma ferramenta grátis. |

A **integridade não volta sozinha** entre os combates. Se ela zerar, a operação acaba. Vencer libera o próximo **nível de ameaça** (0 a 5).

**Ferramentas** são itens passivos da operação (café, honeypot, sandbox, licença de XDR…). **Scripts** são consumíveis usados no meio do combate sem gastar banda (kill -9, bloqueio de emergência, grep nos logs…).

**Cada atacante é um tema de estudo**, e as cartas do combate vêm dos nós desse tema: PESCADOR (engenharia social), CHAVEIRO (acesso e MFA), SONDA (redes), LARVA (OWASP e APIs), GOTEIRA (dados e LGPD), FANTASMA (governança e ameaça interna), PINGUIM ZUMBI (Linux), CRIPTÓFAGO (criptografia e PKI), NIMBO (nuvem), APAGADOR (logs e evasão), ECO (IA) e ARROMBADOR (Active Directory). Chefes: MARIPOSA e ENXAME (ato 1), RATO-REI e NÉVOA (ato 2), CADEADO e ORÁCULO (ato 3).

### O combate

Por turno, com a **intenção do inimigo à vista** (o que ele vai fazer e quanto de dano):

| Ação | Banda | Carta | Acertou | Rápido (1ª metade do tempo) |
| --- | --- | --- | --- | --- |
| Atacar | 1 | flashcard (~12 s) | dano = Ataque | crítico (× Crítico) |
| Defender | 1 | flashcard | bloqueio = Defesa, até o fim do turno do inimigo | +50% de bloqueio |
| Analisar log | 2 | log da técnica anunciada (~25 s) | **anula o golpe**, contra-ataca (Análise) e expõe o inimigo (+50% de dano no resto do turno) | contra-ataque crítico |

- **Errou, a ação falha** e a explicação aparece na hora. O flashcard errado volta como **revisão** nos combates seguintes da mesma operação.
- **Foco**: cada acerto seguido soma +10% de dano e bloqueio (até +50%). Errar zera.
- **Inimigos têm estilos**: uns batem forte uma vez (analise o log), outros dão vários golpes pequenos (defenda), outros se fortalecem ou se curam (ataque antes). A tela de briefing mostra o repertório.
- **Efeitos no jogador**: credencial roubada (−1 de banda), ruído (cartas com menos tempo), vazamento (dano por turno) e sem cobertura (+25% de dano recebido).
- **Chefes** interrompem a luta em 66% e 33% da vida com uma **questão de caso** (as questões longas do banco de provas, 60 s). Acertou: o chefe fica atordoado, perde a próxima ação e leva dano. Errou: ganha fúria (+30% de dano até o fim).

Teclado: 1 atacar, 2 defender, 3 analisar, E encerra o turno; com a carta aberta, A a D (ou 1 a 4) respondem. Som: botão ♪ ou comando `som`.

### Ficha do analista: estudo vira atributo

Cada ramo da árvore alimenta um atributo. O **XP de área** de um ramo é 100 por nível comprovado em prova em cada nó dele (nó enferrujado conta metade) mais o XP das cartas certas nas operações (2 por flashcard ou log, 10 por caso). O XP vira um patamar de 0 a 5 (100, 250, 500, 900, 1400).

| Ramo | Atributo | Efeito |
| --- | --- | --- |
| Redes seguras | Banda | 3 pontos de ação, 4 no patamar 4. Patamar 2 dá um **salto lateral** por ato no mapa (2 no patamar 5). |
| Fundamentos e riscos | Integridade | 80 + 5 por patamar |
| Governança e continuidade | Armadura | bloqueio grátis no início de cada turno (+1 nos patamares 1, 3 e 5) |
| Criptografia e nuvem | Crítico | ×1,5 + 0,1 por patamar |
| Hardening e acesso | Defesa | 5 + 1 por patamar, por carta |
| DevSecOps e APIs | Ataque | 6 + 1 por patamar, por carta |
| Monitoramento e resposta | Análise | 8 + 2 por patamar de contra-ataque |
| Dados e privacidade | Recuperação | +2 de integridade por patamar ao vencer cada combate |
| Tendências e ameaças | Reflexo | +1,5 s por patamar em todas as cartas |

Os atributos são fixados no início de cada operação. A ficha aparece na página da Operação, no Perfil e no mapa da operação.

### Balanceamento

`node tools/sim-run.mjs 300 [ameaça]` joga centenas de operações com um robô que acerta cada carta com uma probabilidade fixa (logs e casos, 10 pontos a menos), responde rápido em 40% dos acertos, analisa o log quando o golpe é grande e defende quando o golpe passaria do bloqueio. Resultado atual (ameaça 0):

| Ficha | 60% de acerto | 70% | 80% | 90% |
| --- | --- | --- | --- | --- |
| Nada estudado (patamar 0) | 0% | 5% | 38% | 89% |
| Um nó por ramo (patamar 1) | 3% | 27% | 81% | 99% |
| Patamar 2 em tudo | 13% | 58% | 95% | 99% |
| Patamar 3 em tudo | 36% | 85% | 99% | 100% |

Conhecimento manda: acertar as cartas pesa mais do que qualquer atributo. Os atributos são o que transforma uma operação apertada numa vitória, e os níveis de ameaça seguram o desafio depois disso. Um combate comum leva em média 12 a 14 cartas (4 a 5 turnos).

## Rodar localmente

Os arquivos de conteúdo são carregados com `fetch`, que não funciona abrindo o `index.html` direto do disco. Use um servidor simples na pasta do projeto:

```bash
python -m http.server 8000     # no Windows, se "python" abrir a Microsoft Store: py -m http.server 8000
# ou, com Node: npx serve -l 8000
# abra http://localhost:8000
```

O save é atrelado ao endereço: use sempre a mesma porta.

## Publicar no GitHub Pages

1. Crie um repositório e envie todos os arquivos desta pasta (inclusive o `.nojekyll`).
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O jogo fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Os caminhos são relativos, então funciona em qualquer subpasta. Repositório público no plano gratuito: as respostas das provas ficam visíveis em `content/exams/`. É um jogo para você, então o acordo de honestidade é com você mesmo.

## Save

O progresso fica no `localStorage` do navegador, atrelado ao domínio. Use **Perfil → Exportar save** de vez em quando; limpar os dados do navegador apaga o progresso. O save tem campo de versão: a 0.4 usa a versão 4 e migra sozinha saves anteriores. Uma operação em andamento da 0.3 é encerrada na migração (o combate mudou); o resto do progresso fica. A operação em andamento fica salva: dá para fechar e continuar depois (um combate interrompido recomeça do início).

## Estrutura

```
index.html
assets/
  css/main.css          estilo (tema de fósforo, responsivo)
  css/battle.css        operação: cena, HUD, cartas, mapa, ficha
  favicon.svg
src/
  main.js               inicialização
  state.js              estado e persistência (único lugar que toca o localStorage)
  content.js            carga e validação do conteúdo
  skilltree.js          regras da árvore, bônus e cargos
  exam.js               motor das provas
  mission.js            motor das missões
  battle.js             motor do combate por cartas (núcleo puro, testável em Node)
  attributes.js         ficha do analista: XP de área → atributos (puro)
  run.js                motor da operação: mapa procedural, nós, recompensas, eventos (puro)
  ui/                   telas (boot, mapa, prova, missão, operação, perfil, terminal)
  ui/run-view.js        operação: página, mapa, nós, recompensas, relatório final
  ui/battle-view.js     tela de combate: intenção, cartas, cronômetro, registro
  ui/battle-scene.js    cena em pixel art (canvas 256×144, efeitos e animações)
  ui/avatar.js          personagem desenhado em código: busto de frente e de costas na estação
  ui/avatar-view.js     editor de personagem
  ui/pet.js             o gato desenhado em código: grande (32×32) e na mesa (13×14), com quadros de animação
  ui/pet-view.js        editor do gato e o gatinho do canto da tela
  ui/pixel-data.js      sprites, ícones e fonte de pixel, desenhados como texto
  ui/sfx.js             efeitos sonoros sintetizados (WebAudio, sem arquivos)
content/
  manifest.json         lista de arquivos de conteúdo
  tree.json             ramos e nós
  exams/*.json          questões por ramo
  missions/*.json       contratos
  battle/techniques*.json técnicas do atacante (ATT&CK, logs, explicações): cartas de análise de log
  run/flashcards.json   flashcards por nó (165)
  run/monsters.json     atacantes comuns, cada um ligado a um tema e a nós
  run/bosses.json       chefes de cada ato
  run/affixes.json      mutadores das elites
  run/items.json        ferramentas e scripts
  run/events.json       imprevistos
tools/
  sim-run.mjs           simulador de operações completas (balanceamento)
  art/                  scripts Python que desenham os sprites
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

**Flashcard** (em `content/run/flashcards.json`): a primeira alternativa é a correta; o jogo embaralha.

```json
{ "id": "fc-net-fundamentos-1", "node": "net-fundamentos",
  "q": "Qual a porta padrão do RDP?",
  "a": ["3389/TCP", "22/TCP", "445/TCP", "5900/TCP"],
  "why": "RDP usa 3389. 22 é SSH, 445 é SMB e 5900 é VNC." }
```

Curto e direto: dá para ler e responder em 6 segundos. Perguntas longas, com log ou cenário, vão para o banco de provas, que alimenta as questões de caso dos chefes.

**Técnica** (em `content/battle/techniques.json`): vira carta de análise de log quando um inimigo anuncia o golpe.

```json
{
  "id": "t-spray", "name": "Pulverização de senhas", "en": "Password Spraying",
  "attack": "T1110.003", "tactic": "Acesso a credenciais", "node": "hard-acesso",
  "source": "Entra ID · logs de entrada",
  "evidence": ["linhas de log, uma ou mais variações"],
  "confusers": ["t-guess", "t-valid", "t-mfa-fatigue"],
  "tell": "O detalhe que entrega a técnica, em uma linha.",
  "explain": "Explicação completa, mostrada depois da resposta e no relatório."
}
```

`confusers` são as alternativas erradas da carta (2 ou 3). `node` é o nó que enferruja quando você erra a análise de um assunto já comprovado. Os campos `tags`, `severity`, `status` e `counter` são da 0.3 e ficam como referência.

**Monstro** (em `content/run/monsters.json`): `id`, `name`, `alias`, `sprite`, `topic`, `nodes` (de onde vêm os flashcards), `acts`, `hp`, `ai` (`random`), `opener` (índice da primeira intenção), `style` (dica de leitura), `flavor` e `intents`. Os valores são do ato 1; `run.js` escala vida e dano por ato (`HP_MUL`, `DMG_MUL`).

```json
{ "type": "attack", "tech": "t-usb-bait", "dmg": 3, "hits": 2 }
{ "type": "debuff", "tech": "t-vishing", "status": "credencial", "turns": 1, "dmg": 4 }
{ "type": "buff", "name": "Lista de alvos", "str": 2, "w": 0.7 }
```

Uma intenção combina `dmg` (com `hits`), `block`, `str` (força: +dano por golpe), `heal` e `status` (`credencial`, `ruido`, `vazamento`, `vulneravel`, com `turns`). Com `tech`, ela pode ser analisada no log; sem `tech`, precisa de `name`. `w` é o peso no sorteio.

**Chefe** (em `content/run/bosses.json`): como o monstro, com `act`, `title`, `briefing`, `defeat`, `ai: "cycle"` (intenções em sequência) e `phases` (`at` em fração da vida, `text`, `str` opcional), que disparam as questões de caso.

**Ferramenta** e **script** (em `content/run/items.json`): ferramentas têm `mods` (`firstTurnAp`, `firstTurnBlock`, `immune`, `logCut`, `atkMul`, `defBonus`, `healAfter`, `firstWrongFree`, `blockCarry`, `creditMul`, `carryMax`, `scriptSlots`, `autoNegate`, `phoenix`, `timerBonus`, `critMulBonus`, `dmgReduce`, `apBonus`, `analyzeDiscount`, `startExposed`, `maxHp`); scripts têm `effects` (`flatDamage`, `heal`, `expose`, `block`, `ap`, `cardCut`, `cleanse`, `focus`) e `price`.

**Imprevisto** (em `content/run/events.json`): `id`, `title`, `topic`, `acts`, `text` e `choices`. Cada escolha tem `outcomes` (com `chance`, `text` e `effects`) ou `quiz` (`nodes`, `win`, `lose`), e pode ter `requires` (`node`/`level` ou `credits`). Efeitos: `hp`, `maxHp`, `credits`, `relic` (raridade ou id), `script`, `unrust` e `fight` (`common` ou `elite`).

Sprites: `tools/art/bestiary.py` desenha os monstros e `gen.py` gera `src/ui/pixel-data.js`. Os arquivos `content/battle/encounters/` (0.2) e `content/battle/actions.json` (playbook da 0.3) não são mais usados e podem ser apagados.

Depois de mexer em números, rode o simulador para ver a taxa de vitória por patamar da ficha e taxa de acerto:

```bash
node tools/sim-run.mjs 300
```

O console do navegador lista qualquer problema de validação ao carregar.
