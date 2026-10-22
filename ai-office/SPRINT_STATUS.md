# AI OFFICE — piano di consegna (100 interventi in 10 sprint)

Ogni sprint ha **10 interventi specifici**, verificati prima di dichiararlo completato.
Questa checklist non implica che il motore AI sia già collegato.

## Sprint 01 — Personaggi 3D (1–10) ✅ Implementato

1. **Rig reali:** uso dei modelli umani professionali GLB con scheletro Biped.
2. **Volti diversi:** ogni personaggio di partenza usa un modello GLB differente.
3. **Capelli:** otto varianti di aspetto/hairstyle già integrate nei modelli originali (non editing libero dei capelli).
4. **Abiti:** otto varianti executive con abiti differenti; colore identificativo del singolo agente.
5. **Camminata:** animazioni walk reali, velocità personali e rotazioni più fluide.
6. **Seduta:** posa procedurale Biped alle scrivanie e mascheramento delle gambe dietro l'arredamento.
7. **Mani/tastiera:** movimenti coordinati degli avambracci e delle dita, *se presenti nel rig*, al PC.
8. **Testa:** orientamento e micro-movimenti per monitor e conversazioni, ripristinati senza deriva.
9. **Sedersi/alzarsi:** transizione fluida prima degli spostamenti, senza partenze mentre si è ancora seduti.
10. **Varietà:** cicli di idle/lettura/riflessione con tempi sfalsati tra persone, non tutti sincronizzati.

La scheda "Personalizza personaggio 3D" permette di scegliere tra **8 modelli differenti**; il modello e il colore vengono salvati in localStorage e ripristinati al riavvio. Sono previste quattro presenze 3D contemporanee nella preview attuale.

**Test automatici:** `ai-office/browser.test.mjs` verifica quattro stili iniziali differenti, disponibilità delle 8 varianti, caricamento dei modelli originali e dei clip Biped, cambio di modello (Nora da f1 a f3), cambio di colore, persistenza dopo reload, seduta, movimento e mobile. Il test `studio.test.mjs` verifica le basi della UI. GitHub Actions `AI Office Studio UI` produce le schermate di controllo.

**Limiti consapevoli:** la scena è una composizione 2.5D, non un ufficio 3D con collisioni reali. Gli aspetti sono varianti dei modelli GLB esistenti, non personalizzazione anatomica libera; contatto perfetto con sedia, mani e tastiera richiede geometria 3D dell'arredamento. Gli incarichi nell'anteprima restano bozze locali: le animazioni non rappresentano esecuzione AI.

**Licenze:** caratteri e animazioni sono del catalogo CodeLove, MIT; conservare avvisi copyright/licenza nell'asset e rispettare il testo MIT per redistribuzioni. https://models.codelove.in/license/

## Sprint 02 — Ufficio premium e ambientazione (11–20) ✅ Codice implementato

11. **Prospettiva dei personaggi:** dimensione corretta gradualmente in base alla profondità e alla posizione in scena, anche durante il cammino (approssimazione prospettica 2.5D).
12. **Ombre di contatto:** ombre morbide sotto ogni agente, modulate da distanza e postura.
13. **Occlusioni reali sulla fotografia:** due sagome dell'immagine originale, perfettamente allineate al fondo, coprono le gambe dei personaggi quando passano dietro alle scrivanie. In browser senza WebGL i segnaposto originali restano disponibili.
14. **Riflessi e luci:** riflessi morbidi di pavimento e vetrate con illuminazione architettonica discreta.
15. **Ciclo ambientale:** Giorno → Tramonto → Notte → Auto (orario locale), con modalità salvata; anche le luci dei modelli 3D vengono adattate.
16. **Monitor animati:** quattro piccoli schermi/indicatori ambientali, che reagiscono alla presenza simulata di agenti alle postazioni (non fingono attività AI reali).
17. **Aree leggibili:** pulsanti Postazioni, Sala riunioni e Area relax con riferimento visivo nella scena.
18. **Meeting evidenziato:** anello di messa a fuoco e didascalia per la sala riunioni, accessibili anche su mobile.
19. **Dettagli ambientali:** microanimazioni ridotte per luci, lampade, riflessi e segnali desktop; rispetto di `prefers-reduced-motion`.
20. **Inquadrature:** tre modalità (panoramica, ravvicinata, focus) con zoom sul dipendente selezionato; su smartphone il panorama scorre dentro la scena, non l'intera pagina. Etichette più piccole e rimozione dei segnaposto 2D duplicati.

**Verifiche:** `ai-office/browser.test.mjs` controlla caricamento degli asset, avatar GLB, profondità/ombre, 4 monitor, 2 regioni di occlusione, illuminazione nelle 4 modalità, zone, tre inquadrature, nessun segnaposto duplicato, mobile e funzioni preesistenti. `studio.test.mjs` continua a verificare la UI originale. Le versioni vengono pubblicate dopo il gate Chrome.

**Limiti:** la scena resta un render illustrato 2.5D, non uno spazio 3D ricostruito. La prospettiva e le occlusioni sono calibrate sull'immagine e non costituiscono fisica completa. Le luci e i dati dei monitor sono effetti ambientali dimostrativi; non certificano attività svolte dal motore AI. Il controllo automatico usa l'ora del browser.

## Sprint 03 — Percorsi e comportamenti (21–30) ✅ Browser e regressione verificati

21. **Percorsi calcolati:** rete di corridoi 2.5D con ricerca del percorso più breve (Dijkstra) in `movement.mjs`.
22. **Incontri fra dipendenti:** rilevamento di vicinanza e precedenza deterministica; un agente rallenta/attende se l'altro sta attraversando il passaggio.
23. **Arredi:** uscite dalle scrivanie, varchi e corsie predefiniti attorno all'isola centrale, senza attraversare direttamente postazioni durante i comandi.
24. **Postazioni riservate:** i quattro posti hanno slot stabili anche quando altri dipendenti vanno in ferie. Massimo quattro avatar simultanei nella versione attuale.
25. **Routine per ruolo:** manager/responsabili più spesso in meeting, creativi più spesso in lounge, analisti lavorano più a lungo al computer, con tempi variati.
26. **Assunzioni:** nuovi agenti disponibili entrano dal proprio ingresso e raggiungono la postazione libera.
27. **Ferie:** comando ferie porta verso l'uscita; un richiamo durante il tragitto interrompe l'uscita e riporta al lavoro.
28. **Pausa caffè:** la lounge è una destinazione reale della rete, con un periodo di sosta e ritorno alla scrivania.
29. **Riunioni:** percorso tramite ingresso laterale della sala riunioni, poi permanenza e ripresa del lavoro.
30. **Movimenti variabili:** velocità individuali, partenze e arrivi smorzati, tempi di lavoro differenziati e niente spostamenti automatici con preferenza reduced-motion.

**Test dedicati:** test GitHub Actions AI Office Studio UI run #39626074489 PASS, screenshot desktop/mobile ispezionati. `movement.test.mjs` per connettività del grafo, rotte attorno ai mobili, deviazioni su corridoi occupati e differenziazione dei ruoli; `browser.test.mjs` per percorsi realmente animati, scrivanie fisse, sala riunioni, lounge, ferie e ritorno, oltre alle regressioni dell'interfaccia. Include correzione di una precedente regressione su etichette mobile.

**Stato release:** completati i 10 interventi dello sprint. Preview statica demo con 4 avatar contemporanei, senza motore AI reale. Altri workflow generali possono risultare ancora in esecuzione.

**Limite dichiarato:** la navigazione è vincolata a corsie mappate manualmente nell'illustrazione. Il rilevamento tra dipendenti è approssimato; non esiste una mappa fisica 3D di collisione o una simulazione di folla, e non è connessa alcuna AI operativa.

## Sprint 04 — Gestione avanzata del personale (31–40) ✅ Implementato

31. **Schede modificabili:** nome, professione, reparto, livello e competenze per ogni agente attivo.
32. **Reparti organizzativi:** otto reparti coerenti con le professioni, con assegnazione automatica alla prima assunzione.
33. **Competenze strutturate:** selezione di massimo cinque competenze da un catalogo controllato, visibili nelle schede.
34. **Livelli di carriera:** Junior, Intermedio, Senior, Lead con ordinamento e memorizzazione.
35. **Promozioni:** avanzamento di livello con blocco a Lead e voce nello storico attività.
36. **Ferie programmate:** intervallo validato, applicato al riavvio/apertura dello studio e rientro dopo la data di fine.
37. **Capacità degli agenti:** fino a tre bozze di incarico assegnate per dipendente, senza pretendere che siano eseguite.
38. **Ricerca dell'organico:** ricerca per nome, professione, reparto, livello e competenze.
39. **Filtri e contatori:** filtro per reparto affiancato agli stati esistenti e conteggio dei risultati/disponibili.
40. **Persistenza e storico:** migrazione compatibile dei profili esistenti in localStorage, modifiche e promozioni tracciate, archivio pensionati conservato e incarichi non eseguiti rimessi da assegnare.

**Verifiche:** test automatici `studio.test.mjs` e `browser.test.mjs` estesi per scheda, promozione, ferie, ricerca, reparti e persistenza su desktop/mobile. La scena premium GLB è invariata. Il gate GitHub Actions del commit finale 806c0de è stato verificato: tutti i cinque workflow PASS, inclusi browser desktop e mobile.

**Limiti dichiarati:** gestione personale esclusivamente locale (nessun cloud o sync); ferie future attivate quando il browser esegue la pagina, non da server; carico basato su bozze assegnate, non su produttività AI reale. I quattro slot 3D simultanei restano invariati.

## Sprint 05 — Interazioni tra agenti (41–50) ✅ Implementato e verificato

41. **Agenda riunioni:** creazione di una riunione con titolo e ordine del giorno, inseriti dal direttore.
42. **Partecipanti controllati:** scelta da due a quattro dipendenti disponibili, senza duplicati.
43. **Convocazione 3D:** alla partenza tutti gli avatar visibili coinvolti raggiungono la sala riunioni tramite la rete dello Sprint 3; una sola riunione attiva.
44. **Turni di parola visivi:** il direttore sceglie il relatore e soltanto il suo avatar può usare il gesto GLB di conversazione; niente testo o audio AI inventati.
45. **Decisioni autentiche:** inserimento manuale di note/decisioni collegate alla riunione, con data.
46. **Richieste di collaborazione:** scelta di mittente, destinatario e obiettivo con verifica degli agenti disponibili.
47. **Approvazione e rifiuto:** soltanto un click esplicito del direttore aggiorna la proposta; nessun finto consenso degli agenti.
48. **Passaggio di incarichi:** una bozza realmente assegnata al mittente può essere trasferita al collega solo dopo approvazione, con verifica della capacità (tre bozze).
49. **Registro cronologico:** log locale di riunioni, note, approvazioni e trasferimenti, anche nel diario generale.
50. **Persistenza e responsive:** nuova sezione Collaborazioni con conteggi, stati, controlli per smartphone, ripristino dei dati dopo reload e cancellazione coerente con il reset dello studio.

**Test:** `studio.test.mjs` include ora 13 test automatici (13 PASS/0 FAIL nel run #39746794408). `browser.test.mjs` verifica il ciclo riunione → scelta relatore → decisione → fine, più proposta → approvazione → trasferimento reale di bozza → persistenza. Il run #39746794408 è PASS su desktop/mobile. Un controllo aggiuntivo dell'overflow della nuova pagina mobile è stato introdotto nel commit successivo e va verificato nel gate finale prima di chiudere la release.

**Limiti dichiarati:** tutti i dati restano in localStorage, senza identità/autorizzazioni server né messaggi AI. Il direttore è l'unico che inserisce decisioni o approva collaborazioni; la presenza/gestualità nella sala riunioni è una simulazione visiva 2.5D/GLB, non prova di discussione o lavoro reali. Avatar contemporanei: massimo quattro.

## Sprint 06 — Motore AI verificabile (51–60) ⚠ Codice implementato, deploy Workers AI non confermato

51. **Backend realmente generativo:** il Worker già presente espone `POST /api/ai/generate` e invoca `env.AI.run` con Llama 3.1 8B FP8; non ricostruisce il runtime Python originale.
52. **Stato esplicito:** `GET /api/ai/status` distingue un Worker configurato da una semplice pagina raggiungibile.
53. **Ruolo contestualizzato:** titolo, descrizione, ruolo professionale e indicazioni compongono la richiesta; i dati sono limitati.
54. **Controllo dell'accesso:** chiave operatore privata, Bearer autenticato e origini HTTPS con CORS allowlist.
55. **Avvio manuale:** nessuna chiamata AI parte in autonomia; l'utente preme Genera dalla scheda dell'incarico.
56. **Nessun token salvato:** la chiave è tenuta soltanto in memoria della pagina ed eliminata dopo ogni ricaricamento.
57. **Risultati reali separati:** solo una risposta riuscita di `env.AI.run` è esposta come *bozza AI generata*, mai come incarico eseguito.
58. **Provenienza e audit:** modello, timestamp e identificativo richiesta accompagnano il testo generato, salvato soltanto in localStorage.
59. **Gestione errori e limiti:** niente falsi successi in caso di quota esaurita, Worker assente, chiave errata o output vuoto; nessun tool esterno disponibile al modello.
60. **Verifiche e rilascio controllato:** 11 test Worker, test UI/Chrome desktop-mobile, workflow GitHub Actions condizionato alle credenziali e preview statica. 

**Esito test disponibili:** Worker `node --test cloudflare/worker.test.mjs` 11/11 PASS nel workflow `AI Office Cloudflare Deploy` del commit `415721c1`; UI browser PASS nel workflow del commit `1fb8a86e` (test di output con API simulata). Gli altri workflow dell'ultimo commit devono essere verificati prima della chiusura tecnica.

**Blocco al deploy:** il workflow `AI Office Cloudflare Deploy` ha indicato esplicitamente `NOT DEPLOYED: missing Cloudflare deployment credentials in GitHub Actions.` Mancano/ non sono disponibili i secrets GitHub `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. Sul Worker occorrono inoltre `AI_OFFICE_API_KEY`, `AI_OFFICE_ALLOWED_ORIGINS` e il binding Workers AI `AI`. Non dichiarare il motore raggiungibile/operativo finché una richiesta reale al Worker pubblicato non produce un risultato verificabile. Il gate grafico e l'anteprima statica non sostituiscono tale verifica.

**Verifica reale Cloudflare del 22/10/2026:** il Worker esistente `ai-office-api` è stato effettivamente pubblicato con GitHub Actions e il relativo binding Workers AI `AI`. L'endpoint `/api/ai/status` ora risponde JSON reale (`service=ai-office`, `version=sprint-06`) ma segnala `ready=false` con `setupIssue=operator_secret_missing_or_short`: il segreto cifrato `AI_OFFICE_API_KEY` è presente (confermato da `wrangler secret list`) ma il valore NON soddisfa i limiti di lunghezza richiesti (24–200 caratteri) oppure non è una stringa valida. Serve aggiornare il valore del segreto su Cloudflare; NON è necessario ricreare token GitHub. I POST da GitHub Actions hanno ricevuto Cloudflare `error code: 1010` (filtro sull'origine del runner): non interpretare questo blocco come risposta dell'API né disattivare protezioni globali per aggirarlo. Verificare poi una generazione con browser umano autorizzato dall'anteprima. Stato Sprint 06: **non ancora convalidato con inferenza live**.

**Limiti consapevoli:** solo generazione di bozze testuali con revisione umana; nessuna esecuzione del runtime OneManCompany, navigazione, invio email o uso di tool. Questa fase NON avvia automaticamente lo Sprint 07.

### Aggiornamento operativo — 22/10/2026 (hardening Sprint 06)

- Aggiornato **`cloudflare/worker.mjs`**: lo stato `ready` richiede il binding AI, una `AI_OFFICE_API_KEY` di 24–200 caratteri *effettivamente nel formato ammesso* e almeno una origine CORS valida; le chiavi non valide restituiscono `503` anche su generate. Le eccezioni di rate limit/quota non vengono presentate come generazioni concluse.
- Aggiornato **`cloudflare/worker.test.mjs`**: copertura di chiavi formalmente invalide, allowlist assente e distinzione errori AI. **GitHub Actions AI Office Cloudflare Tests #140: PASS (12/12)**, run `39783037278`.
- Aggiornato **`ai-office/ai-engine.js`**: comunica quale configurazione manca e distingue chiave errata, quota e rate limit; anche quando `ready=true`, l'interfaccia indica espressamente che serve una *inferenza live* per certificare la generazione.
- **Nessuna prova di inferenza reale**: il test automatico usa un binding AI simulato. La prova live di `POST /api/ai/generate` non è stata ottenuta; l'interrogazione diretta al Worker da questo ambiente non è accessibile. La precedente verifica Cloudflare aveva trovato `setupIssue=operator_secret_missing_or_short`; tale valore **non è stato verificato come risolto**.
- **Intervento necessario su Cloudflare:** aggiornare il segreto cifrato `AI_OFFICE_API_KEY` con un valore robusto nel formato URL-safe, senza inserirlo nel repository né in chat; confermare `AI_OFFICE_ALLOWED_ORIGINS` e la pubblicazione del codice aggiornato sul Worker esistente. Per chiudere lo Sprint 06 occorre una risposta generata effettivamente da Workers AI, autorizzata e verificabile.
- **Deploy verificato:** GitHub Actions `AI Office Cloudflare Deploy` #11, run `39783367548`, **PASS**: Worker `ai-office-api` aggiornato correttamente. `GET /health` e `GET /api/ai/status` rispondono HTTP 200, versione `sprint-06` (log di deploy 22/10/2026). `ready=false`, `setupIssue=operator_secret_missing_or_short` **confermato dopo il nuovo deploy**. La presenza del segreto cifrato `AI_OFFICE_API_KEY` è verificata senza leggere il valore: va sostituito nel pannello Cloudflare con valore compatibile di 24–200 caratteri URL-safe.
- **Test UI:** GitHub Actions `AI Office Studio UI` #255, run `39783037312`, **PASS**, desktop e mobile. Worker test #140 PASS (12/12). Questi test non attestano inferenza live.
- **Limite operativo del runner:** il test automatico `POST /api/ai/generate` non autenticato è filtrato da Cloudflare con HTTP 403 `error code: 1010` prima dell'API. Non disattivare i filtri Cloudflare per aggirare il blocco; eseguire la prova reale da browser umano autorizzato dopo la configurazione.
- **Stato Sprint 06: DEPLOY PASS, CONFIGURAZIONE/INFERENZA LIVE BLOCCATE.** Non avviare lo Sprint 07 prima del completamento.

### Correzione credenziali — 22/10/2026, richiesta dell'operatore

- **Codice aggiornato realmente** in `cloudflare/worker.mjs`, `ai-office/ai-engine.js`, `cloudflare/worker.test.mjs` e `cloudflare/README.md`: `AI_OFFICE_API_KEY` ora accetta **8–200 caratteri ASCII stampabili, senza spazi**, inclusi simboli come `*`, `!`, `#`. Sono supportati i valori brevi da **8 a 10 caratteri**, preservando le chiavi più lunghe già presenti.
- **Autenticazione conservata:** chiave cifrata solo su Cloudflare, invio `Authorization: Bearer`, verifica SHA-256 a confronto costante, allowlist origini, segreto solo in memoria nella pagina. Nessuna credenziale inserita in GitHub.
- **Test aggiunti:** chiavi esemplificative da 8 e 10 caratteri con simboli, password errata rifiutata, invocazione `env.AI.run` soltanto dopo autorizzazione, rifiuto di valori sotto gli 8 caratteri, spazi, caratteri di controllo e lunghezze fuori limite. Sono test con AI simulata, non inferenza Cloudflare online.
- **Sicurezza:** una password da 8–10 caratteri è meno resistente ai tentativi di indovinare rispetto a una lunga chiave casuale. Non disattivare protezioni Cloudflare; valutare protezione rate-limit a livello edge.
- **Verifiche:** GitHub Actions `AI Office Cloudflare Tests` #151 PASS e successivo run sul commit finale; `AI Office Studio UI` #266 PASS (desktop/mobile).
- **Pubblicazione:** workflow del Worker esistente `ai-office-api` #13, run `39798426669`. Lo Sprint 06 resta aperto finché `/api/ai/status` non mostra `ready=true` e una generazione online autorizzata non riesce.

## Prossimi sprint (non ancora completati)

- [x] 02 — Ambiente premium: prospettiva, ombre, occlusioni, riflessi, giorno/notte, schermi, spazi
- [x] 03 — Percorsi intelligenti: collisioni approssimate tra agenti, assegnazione postazioni, entrate/uscite, routine
- [x] 04 — Gestione del personale: ruoli, competenze, reparti, ferie e promozioni
- [x] 05 — Interazioni tra agenti: riunioni, collaborazione, scambi verificabili
- [ ] 06 — Codice motore AI verificabile pronto; deploy Cloudflare ed inferenza reale online ancora da certificare
- [ ] 07 — Incarichi completi: assegnazione, stato reale, output, errori e audit
- [ ] 08 — Telegram, login, cloud, sincronizzazione e backup
- [ ] 09 — Performance, qualità adattiva, sicurezza e affidabilità
- [ ] 10 — Modalità Cinema e flusso di presentazione YouTube

**Regola di avanzamento:** attendere il consenso dell'utente prima di iniziare il prossimo sprint. Non modificare altri progetti del repository.
