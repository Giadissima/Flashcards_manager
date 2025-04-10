// TODO il gruppo può avere un immagine
const http = require('http');
const fs = require('fs');
const path = require('path');
// TODo deve avere un id la card
const server = http.createServer((req, res) => {
  // Definisci il percorso del file HTML da servire
  if (req.url === '/') {
    fs.readFile("index.html", 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Errore nel server');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  }
  else if (req.url === '/new-card') {
    fs.readFile("./src/new-card.html", 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Errore nel server');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  }
  else if (req.url === '/new-group') {
    fs.readFile("./src/new-group.html", 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Errore nel server');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  }

  // Servire il file JSON se richiesto
  else if (req.url === '/flashcards.json') {
    fs.readFile('./data/flashcards.json', 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Errore nel caricamento del JSON');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      }
    });
  }else if (req.url === '/groups.json') {
    fs.readFile('./data/groups.json', 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Errore nel caricamento del JSON');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      }
    });
  }
  else if (req.url === '/add-card' && req.method === 'POST') {
    let body = '';
    
    // Riceve i dati del corpo della richiesta
    req.on('data', chunk => {
      body += chunk;
    });

    // Quando i dati sono stati ricevuti
    req.on('end', () => {
      try {
        const newCard = JSON.parse(body); // Parsea il JSON ricevuto
        console.log(newCard);
        fs.readFile('./data/flashcards.json', 'utf-8', (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error occoured loading JSON file');
            return;
          }

          let flashcards = [];
          try {
            flashcards = JSON.parse(data); // Converte il contenuto in un array di oggetti
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error occoured parsing JSON file');
            return;
          }

          // Aggiungi la nuova card all'array
          flashcards.push(newCard);

          // Scrivi di nuovo l'array nel file JSON
          fs.writeFile('./data/flashcards.json', JSON.stringify(flashcards, null, 2), 'utf-8', (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Errore nella scrittura del file JSON');
              return;
            }

            // Risposta di successo
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Card aggiunta con successo' }));
          });
        });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('error: invalid JSON data');
      }
    });
  }else if (req.url === '/add-group' && req.method === 'POST') {
    let body = '';
    
    // Riceve i dati del corpo della richiesta
    req.on('data', chunk => {
      body += chunk;
    });
    
    // Quando i dati sono stati ricevuti
    req.on('end', () => {
      try {
        console.log("ciao");
        const newGroup = JSON.parse(body); // Parsea il JSON ricevuto
        fs.readFile('./data/groups.json', 'utf-8', (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error occoured loading JSON file');
            return;
          }

          let groups = [];
          try {
            groups = JSON.parse(data); // Converte il contenuto in un array di oggetti
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error occoured parsing JSON file');
            return;
          }

          // Write group into "groups" array
          groups.push(newGroup);

          // Write array into JSON file
          fs.writeFile('./data/groups.json', JSON.stringify(groups, null, 2), 'utf-8', (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Error occourred writing JSON file');
              return;
            }

            // success
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Added group successfully' }));
          });
        });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('error: invalid JSON data');
      }
    });
  }
  else if (req.url === '/delete-card' && req.method === 'POST') {
    let body = '';
  
    // Riceve i dati del corpo della richiesta
    req.on('data', chunk => {
      body += chunk;
    });
  
    // Quando tutti i dati sono stati ricevuti
    req.on('end', () => {
      try {
        const { title } = JSON.parse(body); // Si aspetta un oggetto tipo { "title": "Titolo da eliminare" }
  
        if (!title) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Titolo mancante nella richiesta');
          return;
        }
  
        fs.readFile('./data/flashcards.json', 'utf-8', (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error occoured loading JSON file');
            return;
          }
  
          let flashcards = [];
          try {
            flashcards = JSON.parse(data);
          } catch (parseError) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error occoured parsing JSON file');
            return;
          }
  
          const originalLength = flashcards.length;
          flashcards = flashcards.filter(card => card.title !== title);
  
          if (flashcards.length === originalLength) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Carta non trovata');
            return;
          }
  
          fs.writeFile('./data/flashcards.json', JSON.stringify(flashcards, null, 2), 'utf-8', (writeErr) => {
            if (writeErr) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Errore nella scrittura del file JSON');
              return;
            }
  
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Carta eliminata con successo' }));
          });
        });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('error: invalid JSON data');
      }
    });
  }
  // Gestisci richieste non riconosciute
  else {
    const filePath = path.join(__dirname, req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File non trovato');
      } else {
        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'application/javascript';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        // Aggiungi altri tipi se ti servono

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  } 
});

// Avvia il server sulla porta 3000
server.listen(3000, () => {
  console.log('Server in esecuzione su http://localhost:3000');
});
