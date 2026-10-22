# AI OFFICE Studio — Stato pubblicato

**Preview verificata:** https://ai-office-api.jorrob98.workers.dev/

Il frontend `ai-office/` viene pubblicato sul **Worker Cloudflare esistente** `ai-office-api` e usa `office-real3d.mjs` come scena predefinita.

## Cosa funziona

- Ufficio geometrico interamente 3D in Three.js: pavimento, sedie, scrivanie e persone nello stesso spazio metrico, non su una fotografia.
- Quattro avatar GLB riggati, dimensionati tramite articolazioni reali; posture con bacino all'altezza delle sedie. Test di contatto geometrico nel browser.
- Camera orbitale, zoom e tre modalità di inquadratura; impostazioni responsive.
- Interfaccia per personale, incarichi, riunioni/attività e risultati di bozze AI salvati nel browser.
- Endpoint del Worker AI protetto con chiave operatore; lo stato può risultare pronto ma serve ancora verificare una generazione online autenticata.
- La scena fotografica precedente è disponibile solo come fallback con `?legacy=1`.

## Test e aggiornamenti

- `node --test ai-office/studio.test.mjs ai-office/movement.test.mjs`
- `node ai-office/browser.test.mjs` — funzioni precedenti in fallback legacy.
- `node ai-office/real3d.test.mjs` — scena geometrica, quattro GLB, sedia/bacino e mobile.
- Workflow GitHub Actions **AI Office Studio UI** e **AI Office Cloudflare Deploy**. Il secondo controlla che il file `/preview-version.json` corrisponda al commit frontend effettivamente pubblicato.

## Limitazioni ancora aperte

Gli avatar hanno movimento a clip GLB e postura seduta procedurale, ma i percorsi non hanno ancora navmesh/collisioni complete; digitazione, IK delle mani, realismo della seduta e dettaglio dei modelli richiedono ulteriore rifinitura. La persistenza resta principalmente `localStorage`, senza login/sincronizzazione cloud. Il runtime Python originale non è collegato al Worker; il modello AI produce soltanto bozze su richiesta quando l'inferenza reale risulta disponibile.

Leggere `SPRINT_STATUS.md` per avanzamento dettagliato e criteri di collaudo. **Non dichiarare completo il progetto soltanto perché i test PASS.**
