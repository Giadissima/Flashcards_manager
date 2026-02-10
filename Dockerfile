FROM node:22

# Imposta la directory di lavoro principale
WORKDIR /app

# Copia i file di configurazione del server e installa le dipendenze
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install

# Copia il resto dei file del server
COPY server/ ./

# Torna alla directory di lavoro principale
WORKDIR /app

# Copia i file di configurazione del client e installa le dipendenze
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install

# Copia il resto dei file del client
COPY client/ ./

# Imposta la directory di lavoro per il comando di avvio
WORKDIR /app/server

# Espone la porta di NestJS
EXPOSE 3000

# Avvia il server
CMD ["npm", "start"]
