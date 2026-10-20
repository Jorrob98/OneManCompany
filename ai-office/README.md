# AI OFFICE Studio — anteprima originale

Progetto grafico indipendente aggiunto al fork di OneManCompany, senza toccarne i file originali.

**Apri \`index.html\` in un browser** o pubblica questa cartella come sito statico. L'interfaccia include un ufficio isometrico pixel-art programmato in Canvas, con rendering originale di stanze, mobili e personaggi; pannelli responsive per desktop e smartphone; selezione personaggi; assunzioni, ferie, pensionamenti, reintegri; incarichi in attesa; registro attività.

## Funzioni realmente attive
- Gestione delle persone e degli incarichi **nel browser**; salvataggio con localStorage.
- Controlli sull'ufficio (selezione dei dipendenti, ingrandimento, luce giorno/sera).
- UI responsive originale; non incorpora screenshot o sprite del progetto upstream.

## Cosa NON è ancora funzionante
- **Nessun motore AI**: non vengono svolti incarichi, né esiste una connessione a Ollama/Workers AI.
- **Nessuna sincronizzazione cloud**: profili e incarichi locali non sono condivisi fra dispositivi.
- **Nessuna autenticazione Telegram Mini App**: questa versione è una web preview pubblica e **non** contiene dati privati o chiavi.
- **Nessun backend OneManCompany operativo**: il Worker Telegram è in una cartella distinta e richiede deploy/secrets.

La grafica originale realizzata con Canvas appartiene a questa nuova implementazione. OneManCompany rimane il riferimento concettuale e tecnico per la successiva integrazione degli agenti, con licenza Apache-2.0 separatamente preservata.

## Verifica

Con Node 22:

\`\`\`sh
node --check ai-office/app.js
node --test ai-office/studio.test.mjs
\`\`\`

## Roadmap

1. Salvare configurazioni e incarichi su Cloudflare D1 con autenticazione Telegram server-side.
2. Collegare un modello Workers AI a una coda di attività verificabile.
3. Portare le funzioni di organico, valutazioni, riunioni e autoevoluzione di OneManCompany solo dopo una valutazione di compatibilità.
4. Testare e pubblicare come Telegram Mini App. Azioni esterne/autonome sempre con permessi espliciti e audit.

Niente finti risultati. La demo visualizza solo stati reali del prototipo.
