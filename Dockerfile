# Dev-oriented Dockerfile cho Next.js (dùng với docker-compose).
FROM node:22-alpine

WORKDIR /app

# Cài dependencies trước để tận dụng cache layer
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

EXPOSE 3001

# docker-compose override command thành "npm run dev".
# Khi build production: dùng "npm run build" + "npm start".
CMD ["npm", "run", "dev"]
