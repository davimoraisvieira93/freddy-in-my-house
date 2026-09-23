# Guia de substituição de assets

Regra de ouro: **o nome e o caminho do arquivo importam, o conteúdo não.**
Coloque o arquivo com o nome exato abaixo e o jogo passa a usá-lo
automaticamente. Para renomear, mude apenas `js/config.js` (objeto `ASSETS`).
Enquanto um arquivo não existir, o jogo desenha um placeholder no lugar.

## Imagens

| Onde entra | Caminho esperado |
|---|---|
| Panorama do escritório (mais largo que a tela — visão 180°) | `assets/images/office/background.png` |
| Câmeras 1 a 8 | `assets/images/cameras/cam1.png` … `cam8.png` |
| Estática ao trocar de câmera | `assets/images/cameras/static.png` |
| Freddy em cada nó do caminho dele | `freddy_cam8.png`, `freddy_cam3.png`, `freddy_cam5.png`, `freddy_cam2.png` |
| Freddy — jumpscare | `freddy_jumpscare.png` |
| Bonnie em cada nó | `bonnie_cam8.png`, `bonnie_cam3.png`, `bonnie_cam2.png`, `bonnie_cam4.png` |
| Bonnie parada na Porta Esquerda | `bonnie_na_porta.png` |
| Bonnie — jumpscare | `bonnie_jumpscare.png` |
| Chica em cada nó | `chica_cam8.png`, `chica_cam7.png`, `chica_cam6.png`, `chica_cam1.png`, `chica_cam5.png` |
| Chica — jumpscare | `chica_jumpscare.png` |

(Os arquivos dos personagens ficam todos em `assets/images/enemies/`.)

## Sons

Mesma lista de antes, mais um novo efeito:

| Onde entra | Caminho esperado |
|---|---|
| Risada do Freddy ao se mover com sucesso | `assets/audio/sfx/risada.mp3` |
| Ambiente, porta, estática, energia baixa, apagão, batida, jumpscare, vitória | ver os demais nomes em `js/config.js` (`ASSETS.audio`), todos dentro de `assets/audio/` |

## Trocando os personagens pelos seus

`freddy`, `bonnie` e `chica` em `js/config.js` (`ENEMIES_CONFIG`) são só
identificadores — troque `label` pelo nome de quem você quiser (uma pessoa
da família, um pet) e os arquivos de imagem/som correspondentes. As rotas
(`graph`) e a mecânica especial da Câm 2 (`lockNode`) continuam funcionando
normalmente, independente do nome escolhido — vale renomear antes de
publicar o repositório publicamente.
