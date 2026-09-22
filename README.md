# Guia de sprites — Freddy in My House

> **Aviso:** o `ASSETS-GUIDE.md` que já existe no repositório está
> desatualizado (fala de um panorama único `office/background.png`).
> A versão atual do `js/config.js` (v3, "visões fixas") usa **5 imagens
> separadas** para o escritório em vez de um panorama. Este guia
> substitui aquele.

Regra de ouro: **o nome e o caminho do arquivo importam, o conteúdo
não.** Coloque o arquivo com o nome exato indicado abaixo (com a
extensão certa!) e o jogo passa a usá-lo automaticamente — não precisa
mexer em código nenhum. Enquanto um arquivo não existir (ou tiver nome
errado), o jogo desenha um placeholder cinza com o nome da chave no
lugar, tipo `office.centro`.

⚠️ **Extensão é obrigatória.** No GitHub, ao subir o arquivo, confirme
que o nome final tem `.png` (ou `.mp3` para áudio). Um arquivo chamado
só `centro` (sem `.png`) gera 404 e cai no placeholder — já vimos isso
acontecer neste projeto.

Todo o mapa de caminhos fica em **`js/config.js`**, dentro do objeto
`ASSETS`. Se quiser usar outro nome de arquivo, é só editar o caminho
lá — o resto do código não precisa mudar.

---

## 1. Escritório (as 3 visões fixas)

Cada visão é uma **imagem de tela cheia** (recomendado 16:9, ex.
1920×1080 ou qualquer proporção parecida — o jogo corta/cobre
automaticamente com `drawCover`).

| Visão | Estado | Caminho esperado |
|---|---|---|
| Computador (visão 0) | única | `assets/images/office/centro.png` |
| Porta (visão 1) | porta aberta | `assets/images/office/porta_aberta.png` |
| Porta (visão 1) | porta fechada | `assets/images/office/porta_fechada.png` |
| Janela (visão 2) | janela aberta | `assets/images/office/janela_aberta.png` |
| Janela (visão 2) | janela fechada | `assets/images/office/janela_fechada.png` |

Essas 5 imagens são tudo que você precisa pro cenário do escritório.
Não existe mais um "panorama único" — cada visão/estado é um arquivo
próprio.

## 2. Câmeras (monitor)

| Onde entra | Caminho esperado |
|---|---|
| Câmeras 1 a 8 | `assets/images/cameras/cam1.png` … `cam8.png` |
| Estática ao trocar de câmera | `assets/images/cameras/static.png` |

## 3. Inimigos (Freddy, Bonnie, Chica)

Todos ficam em `assets/images/enemies/`. Cada inimigo precisa de um
sprite por **nó** do caminho dele (`graph`, em `ENEMIES_CONFIG`), mais
um de jumpscare. Se um nó não tiver imagem, aparece um placeholder
vermelho com o nome do personagem.

**Freddy** (rota: cam8 → cam3/cam5 → cam2, depois trava e ataca a porta):
- `freddy_cam8.png`, `freddy_cam3.png`, `freddy_cam5.png`, `freddy_cam2.png`
- `freddy_jumpscare.png`

**Bonnie** (rota: cam8 → cam3 → cam2/cam4 → entra pela porta):
- `bonnie_cam8.png`, `bonnie_cam3.png`, `bonnie_cam2.png`, `bonnie_cam4.png`
- `bonnie_na_porta.png` — aparece quando ela está parada **na porta**, com a porta aberta
- `bonnie_jumpscare.png`

**Chica** (rota: cam8 → cam7 → cam6 → cam1/cam5 → entra pela janela):
- `chica_cam8.png`, `chica_cam7.png`, `chica_cam6.png`, `chica_cam1.png`, `chica_cam5.png`
- `chica_na_janela.png` — aparece quando ela está parada **na janela**, com a janela aberta (imagem nova desta versão; o guia antigo não tinha isso)
- `chica_jumpscare.png`

> Se você mudar a rota de um personagem no `graph` (config.js), lembre
> de ter um sprite pra cada nó novo, senão vira placeholder.

## 4. Ícones da UI (opcional)

| Onde entra | Caminho esperado |
|---|---|
| Ícone de energia | `assets/images/ui/icon_power.png` |
| Ícone de câmera | `assets/images/ui/icon_camera.png` |
| Ícone de porta | `assets/images/ui/icon_door.png` |
| Ícone de luz | `assets/images/ui/icon_light.png` |

## 5. Sons

| Onde entra | Caminho esperado |
|---|---|
| Ambiente (loop) | `assets/audio/ambience/ambience_loop.mp3` |
| Abrir/fechar porta ou janela | `assets/audio/sfx/door_toggle.mp3` |
| Ligar/desligar luz | `assets/audio/sfx/light_toggle.mp3` |
| Estática da câmera | `assets/audio/sfx/camera_static.mp3` |
| Energia baixa | `assets/audio/sfx/power_low.mp3` |
| Apagão | `assets/audio/sfx/blackout.mp3` |
| Batida na porta/janela | `assets/audio/sfx/knock.mp3` |
| Jumpscare | `assets/audio/sfx/jumpscare.mp3` |
| Vitória (6 AM) | `assets/audio/sfx/victory_6am.mp3` |
| Risada do Freddy (ao avançar de nó) | `assets/audio/sfx/risada.mp3` |
| Beatbox do menu | `assets/audio/sfx/beatbox.mp3` |

## 6. Trocando o nome dos personagens

`freddy`, `bonnie` e `chica` em `ENEMIES_CONFIG` (config.js) são só
identificadores internos — o `label` é o que aparece no jogo. Pra
trocar por uma pessoa da família ou um pet:

1. Troque o `label` no config (ex.: `label: 'Vovô'`).
2. Renomeie os arquivos de imagem/som correspondentes, mantendo o
   mesmo padrão (`<id>_cam8.png`, `<id>_jumpscare.png` etc.) — ou
   simplesmente troque os caminhos dentro do próprio objeto do
   inimigo em `config.js` se preferir manter os nomes de arquivo
   como estão.
3. As rotas (`graph`) e a mecânica especial de trava (`lockNode`, só
   no Freddy) continuam funcionando do mesmo jeito, independente do
   nome escolhido.

## 7. Checklist rápido antes de subir uma imagem nova

- [ ] Nome do arquivo bate **exatamente** com o caminho em `config.js` (maiúsculas/minúsculas importam)
- [ ] Extensão `.png` (ou `.mp3`) está no nome do arquivo, não só no caminho do código
- [ ] Proporção ~16:9 para fundos de escritório/câmera (evita distorção com `drawCover`)
- [ ] Testou com Ctrl+Shift+R (hard refresh) pra não pegar cache de um 404 antigo
