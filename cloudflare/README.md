# AI OFFICE — integrazione Cloudflare + Telegram

Questa cartella è un'aggiunta **isolata** al fork di OneManCompany.
Nessun file originale (grafica, sprite, animazioni, Python, agenti) è modificato.

## Stato reale

| Componente | Stato |
| --- | --- |
| Codice webhook privato / comandi /status e /ask | pronto nel repository |
| Test unitari locali | inclusi, eseguibili con Node.js |
| Cloudflare Worker pubblico `ai-office-api` | esiste, ma ha ancora il codice Hello World fino al deploy di questa cartella |
| Telegram Bot | non collegato; occorrono token e proprietario autorizzato |
| Workers AI | binding previsto; da configurare/verificare in Cloudflare |
| Ufficio grafico Telegram Mini App | non ancora pubblicato |
| Motore multi-agente di OneManCompany | non collegato |

Il Worker non può eseguire direttamente il backend Python di OneManCompany.
I comandi non fingono di aver assunto dipendenti o eseguito compiti reali.

## Test

Con Node.js 18+:

```sh
cd cloudflare
node --test worker.test.mjs
```

## Pubblicazione

1. Usare il Worker Cloudflare **esistente** `ai-office-api` (non crearne uno nuovo).
2. Pubblicare `cloudflare/worker.mjs` con Wrangler usando il file
   `cloudflare/wrangler.toml` o dalla console del Worker.
3. In **Cloudflare → Worker → Settings → Bindings**, abilitare **Workers AI**
   con variabile di binding `AI`.
4. Impostare i seguenti valori in **Settings → Variables and Secrets**,
   come **secrets cifrati**. Non copiarli mai nel repository o nella chat:
   - `TELEGRAM_BOT_TOKEN`: da un **nuovo** bot creato con BotFather.
   - `TELEGRAM_WEBHOOK_SECRET`: segreto casuale, consentiti A-Z a-z 0-9 _ -.
   - `TELEGRAM_OWNER_ID`: ID numerico del proprietario del bot.
5. Impostare il webhook Telegram a:
   `https://ai-office-api.jorrob98.workers.dev/telegram/webhook`
   specificando un `secret_token` identico a `TELEGRAM_WEBHOOK_SECRET`.
   Non pubblicare il token del bot in URL da condividere.
6. Verificare `GET /health`; poi, dalla chat privata Telegram, `/start`,
   `/status` e `/ask`.

Il webhook accetta soltanto il segreto configurato e messaggi privati
dall'utente con ID autorizzato. La prima versione non dispone ancora di
una coda persistente, quindi non assicura consegna garantita dei messaggi
in presenza di interruzioni. Workers AI ha limiti di utilizzo gratuiti.

## Prossime fasi

- Adattare **la vera grafica pixel art** del frontend originale per Telegram,
  preservando la licenza Apache 2.0 e verificando le licenze degli asset.
- Aggiungere autenticazione server-side Telegram Mini App e database.
- Collegare stato, ruoli, task e attività reali degli agenti con un motore
  compatibile con l'hosting prescelto. Introdurre conferme prima di azioni
  esterne, scrittura del codice o pubblicazioni.
- Integrare monitoraggio delle quote e gestione errori.
