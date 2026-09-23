# Vigia Noturna — Fangame modular (HTML5 + Canvas + JS puro)

Fangame de sobrevivência ponto-e-clique inspirado nas mecânicas do gênero
popularizado por *Five Nights at Freddy's* (portas, câmeras, gestão de
energia e IA por níveis de agressividade). O código é **inteiramente
original** — nenhuma linha, sprite ou som vem do jogo comercial — e foi
desenhado desde o início para você substituir os personagens genéricos
por fotos da sua própria casa, família e pets.

Sem build step, sem framework, sem `npm install`. É só HTML/CSS/JS puro,
então roda abrindo o `index.html` direto no navegador ou publicando a
pasta inteira no GitHub Pages.

## Como rodar localmente

Abra `index.html` no navegador. Pronto. (Alguns navegadores restringem
`fetch`/módulos ES em arquivos abertos via `file://`, por isso o projeto
usa `<script>` normais, sem `import`/`export` — funciona sem servidor.)

## Como publicar no GitHub Pages

1. Suba esta pasta para um repositório no GitHub.
2. Nas configurações do repositório, vá em **Settings → Pages**.
3. Em "Branch", selecione `main` (ou a branch que você usa) e a pasta `/root`.
4. Salve — em alguns minutos o jogo estará em `https://<seu-usuario>.github.io/<repo>/`.

## Estrutura dos arquivos

```
index.html          Estrutura da página (canvas, HUD, telas)
css/style.css        Todo o visual (tema, HUD, painéis, telas)
js/config.js          <<< MAPA CENTRAL DE ASSETS E BALANCEAMENTO >>>
js/assetLoader.js     Carrega imagens/sons com fallback de placeholder
js/doors.js            Classe Door: estado aberto/fechado
js/power.js             Sistema de energia (consumo e apagão)
js/cameras.js            Sistema de monitor de câmeras
js/enemyAI.js             IA dos inimigos (movimento por ticks/agressividade)
js/ui.js                   Todo o desenho no canvas + atualização do HUD
js/game.js                   Loop principal, liga todos os sistemas
js/main.js                    Bootstrap + liga os botões da tela ao jogo
assets/images/...              Onde entram SEUS sprites (ver ASSETS-GUIDE.md)
assets/audio/...                Onde entram SEUS sons (ver ASSETS-GUIDE.md)
```

Para o passo a passo de como substituir cada imagem/som, veja
**`ASSETS-GUIDE.md`**.

## Como cada lógica foi implementada

### Energia (`power.js`)

A energia é um número de 0 a 100. A cada frame, `PowerSystem.tick()`
soma o consumo por segundo de cada fonte ativa:

- uma taxa-base fixa (a casa sempre gasta um pouco, mesmo com tudo
  desligado);
- `+` uma taxa por **porta fechada** (`Door.getPowerDrainPerSec`);
- `+` uma taxa extra se o **monitor de câmeras** estiver aberto.

Essa soma é multiplicada pelo `powerDrainMultiplier` da noite atual
(`NIGHTS_CONFIG`, em `config.js`), o que faz a dificuldade escalar noite
após noite sem precisar duplicar nenhuma lógica. Ao chegar a 0, o
`onBlackout` callback é disparado uma única vez: todas as portas
destrancam/abrem sozinhas, o monitor para de funcionar, e a cena fica
escurecida (`ui.js`) — a partir daí, qualquer inimigo que chegue a uma
porta vai direto para o cronômetro de ataque, sem defesa possível.

### Portas e janelas (`doors.js`)

Cada porta é uma pequena máquina de estados independente com dois
campos: `isClosed` e `occupiedBy` (id do inimigo parado ali,
ou `null`). A porta **não decide** se o jumpscare acontece — ela só
expõe esse estado. Quem lê o estado e decide "atacar ou não" é sempre o
`enemyAI.js`, então toda a regra de "o que é seguro" fica concentrada
num único lugar.

### IA dos inimigos (`enemyAI.js`)

Cada inimigo tem um **caminho** fixo de cômodos (`path`, em
`ENEMIES_CONFIG`) terminando sempre em `porta:<id>`. A cada
`AI_TICK_INTERVAL_MS` (5s por padrão), cada inimigo "rola um dado" de 0
a 19: se o resultado for menor que a `aggression` da noite atual, ele
avança um passo no caminho. É o clássico esquema de "nível de IA" do
gênero — agressividade 0 é praticamente parado; perto de 19 ele avança
quase a cada tick. Se o cômodo onde ele está não é visto pela câmera há
muito tempo (`AI_NOT_WATCHED_THRESHOLD_MS`), ganha um bônus de chance —
isso incentiva o jogador a girar entre as câmeras, e não travar numa só.

Ao chegar na porta-alvo:
- se a porta está **fechada**: ele "bate" por um tempo
  (`DOOR_KNOCK_RETREAT_MS`) e depois recua, reiniciando o caminho do
  zero após um cooldown;
- se a porta está **aberta**: um cronômetro de ataque
  (`DOOR_ATTACK_GRACE_MS`) começa a contar. Se o jogador não fechar a
  porta a tempo, `enemyAI.js` retorna `true` para `game.js`, que
  dispara o jumpscare em tela cheia.

### Câmeras (`cameras.js` + `ui.js`)

O monitor guarda apenas: se está aberto, qual cômodo está sendo exibido,
e um timestamp de "última vez visto" por cômodo (usado pela IA, acima).
`ui.js` desenha a imagem de fundo daquele cômodo e, por cima, o sprite
de qualquer inimigo que esteja passando por ali naquele momento
(`EnemyManager.getVisibleInRoom`).

## Mecânica da luz — removida (o que você precisa saber)

A luz de checagem (botão 💡 Luz / Apagar) saiu do jogo. Portas e janelas
agora só têm um estado: **aberta ou fechada**.

### O que mudou no código

| Arquivo | Alteração |
|---|---|
| `js/doors.js` | Removidos `lightOn` e `toggleLight()`. `toggleClosed()` só alterna `isClosed`. |
| `js/power.js` | O dreno da luz saiu do cálculo de energia. |
| `js/config.js` | Removidos `POWER_DRAIN_PER_LIGHT_ON_PER_SEC`, o som `audio.lightToggle` e a imagem `images.ui.iconLight`. |
| `js/game.js` | Removido `toggleLight()`. O apagão não mexe mais em `lightOn`. |
| `js/ui.js` | `setDoorButtonsState()` só atualiza o texto do botão Fechar/Abrir. |
| `js/main.js` | Removidos o clique dos botões de luz e os atalhos **Q** e **E** (o **E** do Modo Admin, que recarrega a energia, continua funcionando). |
| `css/style.css` | Removida a regra `button[data-action="toggle-light"].active`. |
| `ASSETS-GUIDE.md` | Tirada a menção ao som de luz. |

### O que você ainda precisa fazer

1. **`index.html`** — esse arquivo não estava entre os que revisei, então
   não mexi nele. Apague o botão de luz de cada `.door-panel`, ou seja,
   toda linha com `data-action="toggle-light"`. Se você esquecer, nada
   quebra: o `main.js` remove esses botões ao iniciar o jogo. Mesmo assim,
   vale limpar o HTML e depois apagar a linha marcada com o comentário
   "A mecânica da luz foi removida" em `wireOfficeControls()`.
2. **Assets (opcional):** pode apagar `assets/audio/sfx/light_toggle.mp3` e
   `assets/images/ui/icon_light.png`. Nada mais carrega esses arquivos.
3. **Textos e tutoriais:** se algum lugar do jogo, do README ou de uma
   página de divulgação ensina "use a luz" ou os atalhos Q/E, atualize.

### Efeito no balanceamento

- Antes, cada luz acesa custava `0.12` %/s de bateria. Com a luz ligada o
  tempo todo, uma noite de 300 s gastava 36 % a mais. Esse custo não existe mais.
- Quem quase não usava a luz não sente diferença. Quem usava vai chegar às
  6h com mais bateria sobrando.
- Se o jogo ficar fácil demais, o ajuste é em `js/config.js`:
  `POWER_DRAIN_BASE_PER_SEC`, `POWER_DRAIN_PER_DOOR_CLOSED_PER_SEC`,
  `POWER_DRAIN_MONITOR_OPEN_PER_SEC` ou o `powerDrainMultiplier` de cada
  noite em `NIGHTS_CONFIG`.
- **A IA e o desenho dos inimigos não mudam.** Nos arquivos que revisei,
  nada lia `lightOn` para decidir o que aparece na tela ou quando um
  inimigo ataca; a luz só gastava bateria. Se o seu `ui.js` local usa
  `lightOn` para revelar o inimigo, precisa remover isso também.

## Aviso sobre o repositório indicado como referência

Ao pesquisar o repositório apontado como referência técnica, percebi que
ele é uma decompilação/recompilação direta do jogo comercial original
(o próprio README dele diz isso), não um fangame com código próprio.
Por isso não usei nada de lá — nem estrutura, nem trechos de código:
toda a arquitetura acima foi escrita do zero, usando apenas mecânicas
genéricas do gênero (que não são protegidas por direito autoral), para
manter este projeto seguro para você publicar como portfólio.
