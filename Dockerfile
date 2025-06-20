# Usa immagine Node base leggera
FROM node:22

# Cartella di lavoro dentro il container
WORKDIR /app

# Copia i package.json e package-lock.json per server (per installare dipendenze)
#COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Installa dipendenze di server
#WORKDIR /app/server
WORKDIR /app/client
RUN npm install

# Torna a /app per copiare il resto
WORKDIR /app

# Copia tutta la cartella client
COPY client ./client

# Copia tutta la cartella server
#COPY server ./server

# Costruisci il progetto NestJS
#WORKDIR /app/server
WORKDIR /app/client
#RUN npm run build

# Esponi la porta su cui gira NestJS
EXPOSE 3000

# Comando di avvio server NestJS 
#CMD ["node", "dist/main.js"]
CMD ["node", "./src/server.js"]