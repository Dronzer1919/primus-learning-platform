# Backend API image (build context = repo root, see docker-compose.yml).
FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

EXPOSE 3001

CMD ["npm", "start"]
