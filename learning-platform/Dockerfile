# Frontend image: build the Angular app, then serve the static bundle with nginx.
# Build context = repo root (see docker-compose.yml).
FROM node:20-alpine AS build

WORKDIR /app

COPY learning-platform/package*.json ./
RUN npm ci

COPY learning-platform/ ./
RUN npm run build          # production build -> /app/www (angular.json outputPath)

FROM nginx:1.27-alpine

COPY deployment-scripts/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/www /usr/share/nginx/html

EXPOSE 80
