FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8081

CMD ["npm", "run", "start", "--", "--host", "lan", "--port", "8081"]
