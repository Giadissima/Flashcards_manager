# Flashcard Manager

Flashcard Manager è un sito web progettato per aiutarti a studiare in modo più efficace tramite la creazione di flashcard personalizzate e test su misura. Grazie a funzionalità avanzate, puoi organizzare il tuo apprendimento in base a materie e argomenti specifici.

<p align="center">
  <img src="client/src/assets/favicon.png" width="150" alt="Flashcards' Logo" />
</p>

## Funzionalità principali

- **Creazione di Flashcard Personalizzate**  
  Crea, modifica e organizza le tue flashcard secondo le tue esigenze di studio.

- **Test Personalizzati**  
  Genera test mirati scegliendo argomenti e materie, per verificare le tue conoscenze in modo efficace.

- **Daily Study & Spaced Repetition**  
  Utilizza la funzione "Daily Study", configurabile secondo le tue preferenze, che applica il metodo di studio della *spaced repetition*. Il sistema programma automaticamente i tuoi ripassi, suddividendoli nei giorni più adatti per massimizzare la memorizzazione a lungo termine.

## Main interface

![Representative image of the project](client/assets/interfaccia%20flashcards_manager%200.1.png "Flashcards Manager Screenshot")

## Come iniziare

1. **Aggiungi le tue flashcard** scegliendo materia e argomento.
2. **Configura la funzione Daily Study** per massimizzare secondo le tue preferenze l'apprendimento.
3. **Svolgi i test personalizzati** per monitorare i tuoi progressi.

## Tecnologie utilizzate

- Frontend: AngularIo + material + bootstrap
- Backend: Typescript + NodeJs + NestJs
- Database: MongoDB

E' facilmente portatile come container Docker

## Aggiornare l'elenco delle università

I dati di università e corsi di laurea vengono dagli open data del MUR
([dati-ustat.mur.gov.it](https://dati-ustat.mur.gov.it/dataset/metadati), licenza IODL 2.0)
e vivono in un file **generato e committato**: `server/src/university/university.data.ts`.

Non vengono scaricati durante la build, di proposito: così una build non dipende
da un servizio esterno, è riproducibile, e ogni cambiamento dell'elenco passa da
un commit che si può leggere.

Il MUR pubblica il nuovo anno accademico **verso settembre/ottobre**. Quando esce:

1. Rigenera il file:

   ```bash
   cd server
   npm run update:university-data
   ```

   Lo script scarica i due CSV, li unisce e riscrive `university.data.ts`.
   In output stampa anno accademico, numero di atenei e di corsi.

2. **Controlla il diff**: è il motivo per cui il file è committato.

   ```bash
   git diff --stat server/src/university/university.data.ts
   ```

   Attese: qualche corso in più o in meno, ogni tanto un ateneo rinominato.
   Se invece sparisce mezzo elenco, il formato della fonte è cambiato: fermati e
   controlla lo script prima di committare.

3. Verifica che compili e che il server risponda:

   ```bash
   cd server && npx tsc --noEmit -p tsconfig.json
   ```

   ```bash
   docker compose up -d --build
   ```

   ```bash
   curl -s http://localhost:3000/university | head -c 200
   ```

4. Committa il file generato e vai in produzione con il solito
   `docker compose up -d --build`.

### Se lo script si lamenta

- **`WARNING - courses whose university is not in the registry`**: un ateneo
  compare nell'offerta formativa ma non in anagrafe, di solito per una
  differenza nel nome. I suoi corsi vengono scartati. Se è un ateneo vero, va
  aggiustata la normalizzazione in `joinKey` dentro
  `server/scripts/update-university-data.mjs`.
- **Caratteri strani** (`?` o rombi al posto di accenti e apostrofi): i due CSV
  del MUR hanno codifiche diverse — il primo è UTF-8, il secondo Windows-1252 —
  e lo script lo gestisce esplicitamente. Se cambiano formato, si vede qui.
- **9 atenei senza corsi** è normale: sono le Scuole Superiori a ordinamento
  speciale (Normale, Sant'Anna, SISSA...) e un ente di ricerca, che offrono solo
  percorsi post-lauream e nell'elenco ministeriale non hanno corsi di laurea.

## Contribuire

Se vuoi contribuire al progetto, apri una issue o invia una pull request!

## Licenza

Questo progetto è distribuito sotto licenza MIT.
