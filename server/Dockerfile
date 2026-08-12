FROM node:20-alpine

# System deps: openssl for Prisma, ffmpeg for video, yt-dlp binary (fast install)
RUN apk add --no-cache openssl ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    mkdir -p /app/uploads/exercises

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Entrypoint: migrate → seed users → seed exercises (hasaneyldrm 1324 exercises with GIFs + ES) → start
CMD ["sh", "-c", "npx prisma migrate deploy && node seed.js && node seed-hasaneyldrm.js && node server.js"]
