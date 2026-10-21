# AI OFFICE — agenti 3D animati (milestone 2)

## Implementato

- **Quattro avatar 3D reali**, riggati e caricati come GLB da CodeLove.
- Animazioni separate di **camminata** e **idle** tramite `THREE.AnimationMixer`.
- Spostamenti calcolati tra ingresso, postazione, area relax e sala riunioni, con transizioni fluide.
- Per ogni agente disponibile: comandi visivi **Scrivania / Riunione / Pausa** direttamente dal profilo.
- Animazione **talk** per pausa e meeting, se il clip remoto è disponibile; altrimenti idle.
- Nome e stato dell'animazione sopra ciascun avatar; uscita animata durante ferie e pensionamento.
- Fino a quattro avatar mobili simultanei in questa fase; agenti aggiuntivi restano gestibili dal pannello.
- Selezione degli agenti tramite controlli HTML accessibili, collegata al pannello dipendente.
- Cambio stato ferie / pensionamento: il personaggio presente raggiunge l'uscita e scompare.
- Desktop/mobile; in smartphone la visuale scorre e si centra sui personaggi.
- WebGL trasparente compositato sull'ambiente premium, con fallback alla scena 2.5D se WebGL o modelli non sono disponibili.
- Browser test che fallisce se due modelli riggati e le animazioni principali non si caricano.

## Stato e limitazioni

Questo è un prototipo visivo verificabile, **non ancora un sistema autonomo AI**.
Gli incarichi restano bozze in localStorage; il movimento degli avatar simula la vita d'ufficio, non l'esecuzione di lavoro.

**Limite grafico noto:** l'immagine ambientale approvata include figure umane statiche. Gli unici avatar 3D realmente mobili in questa fase sono i quattro nuovi soggetti sovrapposti. La futura pulizia/sostituzione del background servirà a evitare doppioni e allineare completamente le prospettive. È preferibile preservare l'impatto scenografico approvato piuttosto che sostituirlo con 3D grezzo.

## Modelli/licenze

- Personaggio femminile: https://models.codelove.in/models/business-female-01/
- Personaggio maschile: https://models.codelove.in/models/business-male-01/
- Animazioni idle/walk/talk: https://models.codelove.in/animations/
- Licenza: **MIT**, modello/animazioni con avviso copyright incorporato nei file GLB: https://models.codelove.in/license/
- Moduli Three.js r169 (licenza MIT).
- I modelli non vengono copiati nel repository in questa prima fase; il sito li carica da domini CORS pubblici, quindi **richiede Internet** e dipende dalla disponibilità del fornitore. La disponibilità va testata per ogni pubblicazione.

Per futuri video e diffusione a molti spettatori: rendere disponibili copie locali con notice MIT, ridurre dipendenze esterne, pubblicare con cache/CDN, rimuovere il doppione statico dal render.

## Verifica automatica

```bash
node --check ai-office/app.js
node --check ai-office/penthouse.js
node --check ai-office/agents3d.mjs
node --test ai-office/studio.test.mjs
node ai-office/browser.test.mjs
```

GitHub Actions **AI Office Studio UI** avvia Chrome reale in test, controlla GLB, quattro modelli, comandi di meeting e ritorno alla scrivania, navigazione, assunzioni, incarichi, localStorage e responsive. I file e il vecchio motore `office3d.js` restano nella cartella per tracciabilità, ma **non sono importati nella pagina pubblica**.

## Ambientazione senza persone (21 ottobre 2026)

Il sito usa `assets/penthouse-empty-v2.webp`, scena nuova senza personaggi incorporati e con le aree di lavoro vuote. L'originale `penthouse-hero.webp` è conservato come backup. Waypoint e hotspot sono allineati ai mobili del nuovo render. Non è una simulazione 3D completa dell'arredamento: gli avatar vengono sovrapposti all'immagine 2.5D.

## Living Office V3 — 21 ottobre 2026

Lo sfondo pubblicato è ora `assets/penthouse-living-v3.webp`, un nuovo ambiente senza figure statiche con grande open space, postazioni multiple e sala riunioni. `agents3d.mjs` mantiene i quattro avatar reali e aggiunge gesti di lettura/riflessione al computer, conversazioni, percorsi con passaggi nei corridoi e soste più lunghe alle scrivanie, così non vagano continuamente. I gesti sono rappresentazioni visive, non esecuzioni AI. Il nuovo ambiente è 2.5D e resta un asset illustrato: i modelli 3D sono sovrapposti, senza collisioni complete con l'arredamento.

## Seduta e attività computer — Living Office V4

- Quando un avatar arriva alla sua postazione, il motore applica una **posa seduta procedurale** al rig Biped (cosce, polpacci, busto, braccia), con transizione graduale.
- Le braccia e gli avambracci compiono **micro-movimenti di digitazione**, intervallati da momenti di lettura del monitor. Le trasformazioni delle ossa sono ripristinate a ogni frame, evitando rotazioni accumulate.
- Quando riceve un comando di movimento, il personaggio **si rialza prima di partire**. Le ferie continuano a provocarne l'uscita.
- Il test in Chrome verifica posa seduta, ossa delle gambe, stato del lavoro e transizione di rialzata.
- **Limite visivo**: il catalogo originale non offre clip dedicate a seduta e digitazione; queste pose sono create in JavaScript e restano sperimentali. Arredi e sedie appartengono ancora al render 2.5D, quindi occlusione e contatto con la sedia non sono fisicamente esatti.
- La digitazione è una simulazione **grafica**, non dimostra che sia stato svolto un incarico reale.
