FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages packages
RUN npm install
COPY . .
EXPOSE 5173
