# Imagen base oficial de Node.js ligera
FROM node:20-alpine

# Establecer directorio de trabajo en el contenedor
WORKDIR /app

# Copiar definiciones de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el código fuente de la API y la base de datos JSON inicial
COPY . .

# Exponer el puerto de la aplicación (3000 por defecto)
EXPOSE 3000

# Variables de entorno por defecto
ENV PORT=3000
ENV NODE_ENV=production

# Comando para ejecutar el servidor
CMD ["node", "server.js"]
