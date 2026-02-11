FROM node:22

# Imposto la working directory
WORKDIR /app

# Copio solo i package.json per installare le dipendenze
COPY package*.json ./

# Installazione pulita delle dipendenze
RUN npm ci

# Copio tutto il resto del progetto
COPY . .

# Pulisco eventuali build precedenti
RUN rm -rf dist/client

# Build del progetto Angular
RUN npm run build

# Installo serve per testare la build
RUN npm install -g serve

# Esposizione porta
EXPOSE 4200

# Avvio del server statico sulla build
CMD ["ng", "serve"]