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

## Sprint 06 — Generazione AI testuale verificabile (implementato nel repository, deploy da verificare)

Questa integrazione utilizza il **Worker Cloudflare già esistente** `ai-office-api`, non un server Python locale.
Il Worker offre:

- `GET /api/ai/status`: indica se il binding Workers AI e la chiave operatore sono configurati; **non** dimostra che il modello abbia risposto.
- `POST /api/ai/generate`: genera una **bozza di testo reale** chiamando `env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", ...)`.
- Autorizzazione `Authorization: Bearer` con segreto `AI_OFFICE_API_KEY` (24–200 caratteri alfanumerici, trattino o underscore), memorizzato soltanto nella memoria della pagina.
- CORS con lista esatta `AI_OFFICE_ALLOWED_ORIGINS` (origini HTTPS separate da virgola, senza slash finale; per esempio `https://YOUR-PREVIEW.shipstatic.com`).
- Input rigorosamente limitato e prompt senza strumenti né operazioni esterne; non è prevista un'esecuzione automatica del backend originale OneManCompany.
- Errori espliciti senza falsi output; risposte positive con `output`, `model`, `producedAt`, `requestId`, `requiresReview`.

**Requisiti di attivazione (in Cloudflare)**

1. Pubblicare la cartella `cloudflare/` come aggiornamento del Worker **ai-office-api** esistente (Wrangler: `npx wrangler deploy --config cloudflare/wrangler.toml` dalla root del repository).
2. Collegare il binding `AI` sotto `[ai]` (già dichiarato nel `wrangler.toml`). **Non è necessario** attivare Telegram per questa API.
3. Creare il segreto cifrato `AI_OFFICE_API_KEY` (almeno 24 caratteri, mai committarlo né scriverlo nei log).
4. Configurare `AI_OFFICE_ALLOWED_ORIGINS` con l'origine HTTPS esatta della preview pubblicata. La lista **non** usa `*`.
5. In **Incarichi** nell'anteprima web: Verifica → incolla la chiave → Attiva → Genera bozza AI. La chiave viene eliminata dalla casella dopo l'attivazione ed è dimenticata al reload. Vengono trasmessi al Worker soltanto titolo, dettagli, ruolo e indicazioni della bozza richiesta.
6. Verificare una vera risposta dal Worker pubblicato, oltre ai test con `env.AI.run` fittizio. Solo dopo questa prova dichiarare **motore AI operativo online**.

`node --test cloudflare/worker.test.mjs` verifica guardrail e successo/errori di inferenza con un binding simulato (non conta come test di quota o inferenza reale).
La preview statica non contiene segreti. L'output è una **bozza da revisionare**, salvata **solo nel browser**; non vengono inviate email, modificate repository, né creati task in servizi esterni.

**Costi:** Cloudflare Workers AI applica le proprie quote e condizioni di utilizzo, che possono cambiare. Non introdurre automaticamente piani a pagamento. Controllare nella dashboard quota e consumo del piano gratuito prima del deploy.

