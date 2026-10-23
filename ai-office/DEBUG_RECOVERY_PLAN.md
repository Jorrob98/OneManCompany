# AI OFFICE — Piano di debug e stabilizzazione

**Data audit:** 24/10/2026 · **Repository:** `Jorrob98/OneManCompany` · **Branch:** `ai-office/cloudflare-telegram-v1` · **PR:** #1

**Preview esistente:** https://ai-office-api.jorrob98.workers.dev/  
**SHA effettivamente pubblicato:** https://ai-office-api.jorrob98.workers.dev/preview-version.json  
**Fallback salvaguardato:** `?legacy=1` (non sostituire i progressi 3D).  
**Regola:** non creare nuovi progetti/repo o foto sostitutive; non confondere con Dealer Cockpit, SCELTO, DocFix. Non trattare test PASS come prova che l'esperienza utente sia accettabile.

## Strategia operativa

Un problema alla volta con questa sequenza obbligatoria:
**riproduci → raccogli prove → identifica causa → test rosso → correzione minima → test verde → screenshot desktop/mobile → deploy solo con gate PASS → confronta SHA online → aggiorna registro.**
Non cancellare dati reali, non inviare credenziali nei log, non indebolire autenticazione. Se il gate è rosso, **non pubblicare**.

## Le otto fasi

| Fase | Priorità | Area | Problemi / interventi specifici | Criterio di accettazione |
| --- | --- | --- | --- | --- |
| 1 | P0 | Osservabilità e affidabilità | Log errori WebGL/GLB sanitizzati, stato runtime, tempi caricamento, FPS effettivi (non target), draw call, leak mesh/hotspot, controlli sui dati, tracce CI riproducibili | Test browser riproducono bug, contatori stabili dopo cambi personale/zoom, nessun errore JS silenzioso |
| 2 | P0 | Persone e navigazione 3D | Stato seduto → si alza → cammina → si ferma → torna → si siede, false arrival, asset loader duplicato, mesh cliccabili stale, modello sostituito in tempo reale, assunzione di collisioni | Tutti i 4 avatar completano i percorsi entro timeout; la posa e la posizione reale sono coerenti; le mesh rimosse non sono selezionabili |
| 3 | P0 | Regressioni visuali | Camera desktop/iPhone, scale corpi, bacino-ginocchia-piedi, piedi a terra, sedie, compenetrazioni, elementi tagliati, label leggibili | Screenshot ai momenti chiave, controllo umano; confronto con baseline, non solo pixel/image snapshots |
| 4 | P1 | Prestazioni e fluidità | Misura p50/p95 frame time su viewport emulati, input latency, draw calls, triangoli, GPU DPR, memoria dopo cicli, visibilità tab, batterie e motion preference | Nessun degradamento tra run iniziale e stress test; niente saltellamento camera; qualità adattiva misurata |
| 5 | P1 | Usabilità | Touch/pinch, click sui GLB, selezione agente, nuovi incarichi, modali, errori guida, viewport stretti, contrasto | E2E dei flussi essenziali su desktop e viewport iPhone; no pulsanti irraggiungibili né scroll orizzontale pagina |
| 6 | P0 per motore reale | Worker AI/Telegram | Status live, CORS/auth, 8+ caratteri supportati, rate limit, timeout, generazione autenticata vera solo con segreto locale, gestione errori, bot e webhook | Il risultato AI proviene realmente da Workers AI e ha ID/modello/response controllati; nessun successo simulato |
| 7 | P1 | Dati e sincronizzazione | Data model; backup/export; protezione da localStorage saturo; login/isolamento; sincronizzazione Windows-iPhone; migrazione senza perdere dati | Dati sopravvivono a reload/riavvio, migrazione e dispositivi distinti; RLS/auth testati prima di condividere dati |
| 8 | P0 di rilascio | QA finale / deploy | Test unitari + integrazione + WebGL + screenshot reali + performance; continuità Cloudflare Worker; versione e rollback documentati | SHA preview coincide con commit validato, smoke test online, nessun blocco P0; 100% solo se criteri di prodotto verificati |

## Difetti identificati direttamente nel sorgente (audit iniziale)

- **P0 `office-real3d.mjs`:** in `animate()`, se la destinazione è lontana ma la posa seduta non è ancora svanita, `else a.point=a.goal` **marca il punto di arrivo senza alcun movimento**. Va corretto e testato.
- **P0 `office-real3d.mjs`:** `interactive` registra mesh dei GLB ma non le elimina quando un agente va in pensione/cambia modello: raycast su mesh stale e risorse inutilmente trattenute.
- **P1 `office-real3d.mjs`:** `syncPeople()` avvia `loader.loadAsync()` per ogni evento prima del completamento e senza caching delle promesse; rischia download doppi o richieste concorrenti.
- **P1 `office-real3d.mjs`:** `window.AIOAgents3D.agents` è aggiornato solo nel `boot()`, non quando cambia il personale.
- **P1 `app.js`:** `renderAll()` richiama `save()` e manda `studio:changed` anche per aggiornamenti puramente visuali, potenziale lavoro superfluo.
- **P1 `app.js`:** vecchio renderer canvas 2D continua a ricevere frame di animazione anche quando la scena 3D è la sola visibile; misurare l'impatto prima di modificarlo.
- **P0 QA `real3d.test.mjs`:** controlla bacino/sedia e configurazioni target FPS, **non** il percorso completo in tutte le zone né i frame-time reali, il retirement, i duplicati e il modello sostituito.
- **P0 prodotto:** `AI_OFFICE_API_KEY` e binding possono essere `ready=true` senza aver effettuato una vera generazione Workers AI; l'esito di inferenza resta **non verificato**.
- **P1 prodotto:** documenti/incarichi in `localStorage`, nessuna sincronizzazione cloud dimostrata.
- **P2 grafica:** animazioni rig procedurali ancora limitate; no navmesh o IK mani e piedi completo; camera può tagliare parti della scena in focus.

## Ciclo di test da estendere

**Test 3D:** 4 agenti iniziali; cicli `desk → meeting → lounge → desk`; nessun arrivo anticipato; test posa e contatto; clic solo sui GLB ancora visibili; pensionamento, riassunzione e cambio GLB; cambio orientamento mobile e pinch multi-touch; stress di selezione/camera.

**Profilazione:** durante uno scenario Playwright raccogliere `performance.now()` frame samples, percentili, `renderer.info.render.calls`, tris, geometrie, DPR, quality tier, errori JS e WebGL context lost. Non certificare FPS hardware iPhone usando solo emulazione Chrome.

**Dati:** usare profili temporanei, non cancellare la libreria dei dati del proprietario. Snapshot prima di eventuali migrazioni DB.

## Registro operativo

| Check | Stato |
| --- | --- |
| Piano salvato nel repository | Eseguito |
| Baseline precedente del deploy (grafica) | `d39d96eb20919e0e15ad100f0b5013d05d1bea4d` verificato dalla CI passata; ricontrollare SHA corrente prima di ogni report |
| Fase 1/2: controlli del percorso e raccolta risorse stale | In lavorazione; non dichiarare PASS prima della CI |
| Fasi 3–8 | Aperte |

**Report per ogni modifica:** 1 problema, 1 causa, file modificati, commit, test PASS/FAIL, screenshot, **link preview** e esatta revisione online. Se codice commit ma non deploy, scrivere "preview precedente". Nessuna percentuale inventata.
