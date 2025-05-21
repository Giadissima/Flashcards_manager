# parto da un immagine di nodejs  versione 22
FROM node:22
# setto la workdir del container in /app
WORKDIR /app
# copio tutti file e sottocartelle da locale a /app del container
COPY . .
# scarico le dipendenze. RUN serve per preparare l'immagine (ancora in fase di elaborazione)
RUN npm i

EXPOSE 3000

# CMD è il comando che viene eseguito in automatico una volta che l'immagine è pronta
CMD ["npm", "run", "build"]