# AI OFFICE — agenti 3D animati (milestone 1)

## Implementato

- **Due avatar 3D reali**, riggati e caricati come GLB da CodeLove.
- Animazioni separate di **camminata** e **idle** tramite `THREE.AnimationMixer`.
- Spostamenti calcolati tra ingresso, postazione, area relax.
- Selezione degli agenti tramite controlli HTML accessibili, collegata al pannello dipendente.
- Cambio stato ferie / pensionamento: il personaggio presente raggiunge l'uscita e scompare.
- Desktop/mobile; in smartphone la visuale scorre e si centra sui personaggi.
- WebGL trasparente compositato sull'ambiente premium, con fallback alla scena 2.5D se WebGL o modelli non sono disponibili.
- Browser test che fallisce se due modelli riggati e le animazioni principali non si caricano.

## Stato e limitazioni

Questo è un prototipo visivo verificabile, **non ancora un sistema autonomo AI**.
Gli incarichi restano bozze in localStorage; il movimento degli avatar simula la vita d'ufficio, non l'esecuzione di lavoro.

**Limite grafico noto:** l'immagine ambientale approvata include figure umane statiche. Gli unici avatar 3D realmente mobili in questa fase sono i due nuovi soggetti sovrapposti. La futura pulizia/sostituzione del background servirà a evitare doppioni e allineare completamente le prospettive. È preferibile preservare l'impatto scenografico approvato piuttosto che sostituirlo con 3D grezzo.

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

GitHub Actions **AI Office Studio UI** avvia Chrome reale in test, controlla GLB, numero modelli, navigazione, assunzioni, incarichi, localStorage e responsive. I file e il vecchio motore `office3d.js` restano nella cartella per tracciabilità, ma **non sono importati nella pagina pubblica**.
