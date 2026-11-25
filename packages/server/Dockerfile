FROM node:22-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY client-dist ./client-dist

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && node src/index.js"]
