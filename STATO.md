# Stato del progetto

Aggiornato al 24 novembre 2026.

Bot Telegram **@reachmediaos_bot** dentro l'app Next.js 14 su Vercel (progetto `reachmedia-os-chat`, dominio chat.reachmedia.it). Riceve messaggi in italiano e li mette su Google Calendar (account arditnwork@gmail.com, via Composio) e su Notion. Controlla anche le mail dei clienti senza risposta e prepara le bozze, senza mai inviarle.

## Fatto

### Calendario e Notion
- **Creazione:** un messaggio diventa un evento nel calendario dell'area giusta, con i promemoria della sua categoria. Per le "cose da fare" crea anche una task in Notion con la stessa Deadline e il link all'evento.
- **Modifica, spostamento ed eliminazione** di eventi, chiesti a parole. La conferma usa l'orario che Google restituisce dopo la scrittura.
- **Pulsanti:**
  - "Annulla" su ogni azione;
  - scelta dell'ora con pulsanti quando manca;
  - domanda in sospeso che si unisce alla risposta successiva.
- **Bot Log in Notion:** ogni messaggio e ogni azione restano registrati. Gli stessi dati servono come memoria breve della conversazione (ultimi 60 minuti).
- **Duplicati:** i messaggi identici entro 2 minuti e gli update Telegram ripetuti vengono ignorati.

### Messaggi programmati (ora di Roma)
- **8:00 briefing:**
  - "🎯 Le 3 cose di oggi" con il pulsante "✅ Fatto", che segna la task Done;
  - "📅 Il resto di oggi";
  - "📌 Da recuperare";
  - "📧 Da rispondere".
- **14:00:** un messaggio solo se dalla mattina sono arrivate nuove mail dei clienti.
- **21:00 piano di domani:** "🌙 Domani" più "📧 Da rispondere".

### Mail dei clienti senza risposta (`f6aeee7`)
- **Caselle:**
  - arditnwork@gmail.com per tutti i clienti;
  - email.ma.agency@gmail.com solo per Luxyt, con le bozze solo lì.
- **Quali mail:**
  - solo dai clienti attivi, riconosciuti dal campo "Email" della tabella Clienti;
  - solo degli ultimi 14 giorni;
  - al massimo 10 bozze nuove per ogni controllo.
- **Per ogni conversazione, una volta sola:** una bozza di risposta nella stessa conversazione e nella lingua della mail, con `[DA COMPLETARE: …]` dove mancano dati, più una task Notion con "Link Gmail" e Deadline oggi.
- **Quando rispondi:** la task passa a Done al controllo successivo. Se il cliente riscrive, la stessa task si riapre.
- **Scartate:** newsletter e notifiche automatiche, inviti a riunioni, ringraziamenti e chiusure che non chiedono niente, e mail in CC che non ti riguardano (decide Claude).
- **@istudios.it:** la mail va al cliente nominato tra Seventy Venezia, Shirò Pagani Boutique e Squale SA. Se non ne è nominato nessuno, la task non ha cliente e ha "iStudios" nel titolo.
- **Su richiesta:** "controlla le mail" in chat.

### Sicurezza e infrastruttura
- **Chat web e sue API:** solo per l'account Google arditnwork@gmail.com.
- **Rotte del bot e dei cron:** rispondono 401 senza il segreto (secret token di Telegram, `CRON_SECRET`).
- **Messaggi Telegram in HTML:** tutti i testi dinamici sono escapati, con un test in `scripts/test-telegram-html.ts` (11 test).
- **Deploy:** automatico dal push su `main`, collegato a GitHub `ooindoo/reachmedia-os-chat`.
- **Pulizia della cartella:** tolti i file che non c'entravano col progetto, spostati nel Cestino.
  - un'immagine Squale;
  - due font duplicati di `app/fonts`;
  - una miniatura PNG mai usata;
  - due file `client_secret` di Google. Il codice non li legge, perché usa le variabili d'ambiente.

## Deciso

### Calendario
- **Cinque calendari di area:** Chiamate lavoro, Lavoro clienti, Burocrazia e soldi, Airbnb, Personale.
  - Il calendario principale non si usa mai.
  - Non si imposta mai `colorId`.
  - Un evento non si sposta mai tra calendari: si elimina e si ricrea.
- **Durata:** se dici l'ora di fine viene rispettata, anche sotto i 30 minuti. Altrimenti l'evento dura 30 minuti e la durata non viene mai stimata.
- **Chiamate:** quelle con un nome sconosciuto vanno in Chiamate lavoro, salvo che siano chiaramente personali.
- **Promemoria per categoria:**
  - chiamata: 15 minuti prima e all'inizio;
  - personale: 1 giorno, 1 ora e 15 minuti prima;
  - pratica: la sera prima alle 20:00, 1 ora e 10 minuti prima;
  - scadenza lavoro: 2 giorni, 1 giorno e 1 ora prima;
  - airbnb: 1 giorno e 1 ora prima, solo per check-in e check-out.

### Notion
- **Appuntamenti** (ora fissa): solo il calendario.
- **Cose da fare:** calendario più task Notion. Nel dubbio è una cosa da fare.
- **Promemoria personali:** mai una task Notion.
- **To-do Airbnb** (per esempio Ross1000): categoria "pratica" e cliente "Giuseppe Toniolo (Airbnb)".
- **Campi scritti:** solo Task, Cliente, Deadline, Stato e Tipo attività (più Link Gmail per le mail). Clienti si legge e basta, tranne il campo Email.
- **Domanda in sospeso:** se il messaggio parla d'altro, o dopo 60 minuti, il bot lo dice una volta ("… me la dici?") e poi la chiude con un avviso.

### Gmail
- **Divieti:** mai inviare, eliminare o archiviare. Solo lettura e bozze.
- **Configurazione:** quella standard gestita da Composio, perché Google blocca quella personalizzata con permessi ridotti. Google dà accesso completo, quindi il limite è nel codice: `lib/bot/gmail.ts` può chiamare solo 4 tool, cioè profilo, ricerca, lettura della conversazione e creazione della bozza.
- **Controllo della casella:** prima di ogni controllo verifica che sia quella giusta.

### Generale
- **Canale:** Telegram, non WhatsApp.
- **Modello:** `claude-sonnet-5-5`.
- **Segreti:** mai aprire, leggere o stampare `.env.local` o i valori delle variabili d'ambiente. Si controlla solo se esistono o se sono uguali.
- **Commit e push:** solo dopo il tuo ok.
- **Funzioni:** niente che non sia stato chiesto.

## Aperto

- **Primo controllo vero delle mail:** domani 25 novembre alle 8:00, che dovrebbe creare 10 bozze e 10 task, più l'undicesima alle 14:00. Va verificato che bozze, task e la sezione "📧 Da rispondere" escano come nella prova.
- **NOESI e Giuseppe Toniolo** non hanno il campo Email: le loro mail non vengono controllate finché non lo aggiungi.
- **Mail in Ccn:** nel report vengono mostrate come "A". È solo un difetto di visualizzazione, non ancora corretto.
- **Log di Vercel:** con il piano Hobby restano solo 1 ora. Un errore di notte si vede solo nel Bot Log o nel messaggio di avviso su Telegram.
- **Accesso Gmail completo:** Composio tiene un accesso completo alle due caselle. Il limite è solo nel codice, quindi qualsiasi modifica a `lib/bot/gmail.ts` va guardata con attenzione.
