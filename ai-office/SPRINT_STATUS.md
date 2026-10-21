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

## Prossimi sprint (non ancora completati)

- [x] 02 — Ambiente premium: prospettiva, ombre, occlusioni, riflessi, giorno/notte, schermi, spazi
- [ ] 03 — Percorsi intelligenti: collisioni, assegnazione postazioni, entrate/uscite, routine
- [ ] 04 — Gestione del personale: ruoli, competenze, reparti, ferie e promozioni
- [ ] 05 — Interazioni tra agenti: riunioni, collaborazione, scambi verificabili
- [ ] 06 — Motore AI realmente operativo, strumenti, verifiche e autorizzazioni
- [ ] 07 — Incarichi completi: assegnazione, stato reale, output, errori e audit
- [ ] 08 — Telegram, login, cloud, sincronizzazione e backup
- [ ] 09 — Performance, qualità adattiva, sicurezza e affidabilità
- [ ] 10 — Modalità Cinema e flusso di presentazione YouTube

**Regola di avanzamento:** attendere il consenso dell'utente prima di iniziare il prossimo sprint. Non modificare altri progetti del repository.
