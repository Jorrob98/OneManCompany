# AI OFFICE — Penthouse Control

Questa cartella contiene la nuova applicazione web **AI OFFICE Studio** collegata al fork di OneManCompany.
La versione attuale usa una **scena premium illustrata pre-renderizzata** come asset locale
(`assets/penthouse-hero.webp`), con interazioni di gestione aggiunte via JavaScript.
Il rendering approvato riguarda solo l'ambiente dell'ufficio, non è una schermata
statica dell'intera interfaccia.

## Funzioni disponibili nell'anteprima

- Grafica premium e ufficio panoramico in `index.html` con asset locale.
- Segnaposto selezionabili degli agenti sul render; si aggiornano in base agli agenti disponibili.
- Assunzione, ferie, pensionamento e reintegro degli agenti nel browser.
- Creazione ed eliminazione incarichi in attesa, diario di attività locale.
- Layout desktop + mobile con panoramica scorrevole; zoom e filtro d'illuminazione.
- Dati dell'anteprima salvati solo su `localStorage`, senza sincronizzazione cloud.

## Limitazioni esplicite

- La scena è **2.5D**, non un modello 3D navigabile né un'immagine dell'intera applicazione.
- Gli agenti AI **non eseguono ancora** gli incarichi; il backend originale Python di OneManCompany non è connesso.
- Telegram, login e cloud database sono da integrare. Il Worker di prova è in `../cloudflare/`.
- Non c'è un piano Pro da acquistare per questa anteprima; la versione attuale non invia dati a servizi AI.

## File di progetto

- `index.html`: navigazione e schede del prodotto.
- `style.css`: tema originale e scena premium responsiva.
- `app.js`: gestione locale di organico, incarichi e interazioni.
- `penthouse.js`: segnaposto degli agenti sopra la scena, sincronizzati con `app.js`.
- `assets/penthouse-hero.webp`: asset visivo approvato.
- `office3d.js`: vecchio esperimento 3D, **non importato nella pagina**.
- `browser.test.mjs`, `studio.test.mjs`: verifiche del prodotto.

Per verificare: `node --check ai-office/app.js` e
`node ai-office/browser.test.mjs` (richiede Chromium e Playwright).
