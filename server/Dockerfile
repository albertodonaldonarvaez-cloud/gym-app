FROM node:20-alpine

# System deps: openssl for Prisma, python3+yt-dlp for video downloads, ffmpeg for mp4 conversion
RUN apk add --no-cache openssl python3 py3-pip ffmpeg curl && \
    pip3 install --break-system-packages yt-dlp && \
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
