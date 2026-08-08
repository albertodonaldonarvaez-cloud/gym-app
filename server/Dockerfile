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

# Entrypoint: migrate → seed users → seed exercises (free-exercise-db ~900 + extra ~400) → start
CMD ["sh", "-c", "npx prisma migrate deploy && node seed.js && node scripts/seed-exercises.js && node scripts/seed-exercises-extra.js && node server.js"]
