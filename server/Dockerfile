FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Entrypoint: migrate → seed (Free Exercise DB + users) → start server
CMD ["sh", "-c", "npx prisma migrate deploy && node seed.js && node server.js"]
