# ---- STAGE 1: build Angular ----
FROM node:22 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ---- STAGE 2: nginx ----
FROM nginx:alpine as nginx

# Copia la build Angular dentro nginx (notare l'aggiunta di /browser)
COPY --from=build /app/dist/client/browser /usr/share/nginx/html

# Copia la configurazione nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]