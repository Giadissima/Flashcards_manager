FROM node:22

WORKDIR /app

# Copia solo i file di configurazione per installare le dipendenze
COPY server/package*.json ./server/

# Installa dipendenze
WORKDIR /app/server
RUN npm install

# Espone la porta NestJS
EXPOSE 3000

# Avvia in modalità dev con watch (necessario bind mount per hot reload)
CMD ["npm", "run", "dev"]
