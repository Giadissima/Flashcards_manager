FROM node:22

# Imposta la directory di lavoro principale
WORKDIR /app

# Copia i file di configurazione del server e installa le dipendenze
COPY . .
RUN npm install

# Espone la porta di NestJS
EXPOSE 3000

# Avvia il server
CMD ["npm", "start"]
