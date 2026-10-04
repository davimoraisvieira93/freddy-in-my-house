# Ranking geral online (Modo Infinito) — passo a passo

O jogo já funciona **offline**: depois da primeira visita (pelo site, não abrindo o
arquivo direto), ele carrega sem internet. O ranking **geral** só precisa de um
banco gratuito. Sem ele, o ranking fica só no seu navegador.

1. Entre em https://console.firebase.google.com e crie um projeto (grátis).
2. Menu **Build → Realtime Database → Create Database** (qualquer região).
3. Aba **Rules**, cole o texto abaixo e clique em **Publish**:

```json
{
  "rules": {
    "vigianoturna": {
      "scores": {
        ".read": true,
        ".indexOn": ["ms"],
        "$id": {
          ".write": "!data.exists()",
          ".validate": "newData.hasChildren(['name','ms','t']) && newData.child('name').isString() && newData.child('name').val().length <= 20 && newData.child('ms').isNumber() && newData.child('ms').val() >= 0 && newData.child('ms').val() <= 86400000"
        }
      }
    }
  }
}
```

   Isso deixa qualquer um **ler** e **adicionar** marcas, mas não apagar nem
   alterar as que já existem.
4. Copie a URL do banco (algo como `https://seu-projeto-default-rtdb.firebaseio.com`).
5. Cole em `js/config.js`, em `ONLINE_CONFIG.databaseUrl`, e publique de novo.

## Avisos honestos
- Como o jogo roda no navegador, **um jogador esperto pode enviar uma marca falsa**.
  As regras acima limitam valores absurdos, mas não impedem trapaça. Serve para
  jogo entre amigos; para algo competitivo seria preciso um servidor que valide.
- Sem internet na hora de morrer, a marca vai para uma fila e é enviada sozinha
  quando a conexão voltar.

## Noite salva
O jogo guarda no navegador em qual noite você parou e o botão principal do menu
continua dela. "Novo Jogo" (aparece quando há noite salva) recomeça da Noite 1.
O progresso fica **neste navegador/aparelho**; trocar de aparelho começa do zero.
