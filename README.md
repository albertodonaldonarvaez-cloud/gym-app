# 🏋️‍♂️ GymAura Liquid Glass Edition

<p align="center">
  <img src="https://img.shields.io/badge/Kotlin-1.9.23-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin">
  <img src="https://img.shields.io/badge/Jetpack%20Compose-2024.05.00-4285F4?style=for-the-badge&logo=android&logoColor=white" alt="Jetpack Compose">
  <img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4.19-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/Design-Apple%20Liquid%20Glass-007AFF?style=for-the-badge&logo=apple&logoColor=white" alt="Apple Liquid Glass">
</p>

---

## 📌 Descripción General

**GymAura Liquid** es una aplicación móvil nativa desarrollada en **Kotlin** con **Jetpack Compose**, acompañada de una API **RESTful Backend en Node.js** totalmente **Dockerizada**. 

Diseñada bajo el concepto estético **Apple Liquid Glass (Glassmorphism)** en **Modo Light (Claro)**, ofrece una visibilidad óptima bajo la iluminación del gimnasio o luz solar directa, proporcionando a atletas y entrenadores una experiencia táctil, moderna y ultrafluida.

---

## ✨ Características Destacadas

### 🏋️‍♂️ 1. Catálogo Completo de Ejercicios
- **+30 Ejercicios Precargados** organizados por grupos musculares (*Pecho, Espalda, Pierna, Hombro, Bíceps, Tríceps, Abdomen, Cardio*).
- **Búsqueda Inteligente**: Filtrado instantáneo por nombre de ejercicio o grupo muscular.
- **Fichas Técnicas**: Modales interactivos con equipamiento requerido, técnica de ejecución y sugerencias de series y repeticiones.

### 👥 2. Sistema de Roles Integrado (Coach & Cliente)
- **Modo Entrenador (Coach)**:
  - Gestión centralizada de atletas y objetivos personales.
  - **Planificador de Rutinas Semanales**: Asigna y modifica ejercicios por día (*Lunes a Domingo*) indicando peso meta, series y repeticiones.
  - Creador de nuevos ejercicios en el catálogo global.
  - Registro rápido de nuevos clientes.
- **Modo Cliente**:
  - Vista dinámica del plan de entrenamiento del día actual.
  - **Subida de Peso en Tiempo Real (`+ Subir Peso`)**: Permite registrar series completadas, peso cargado (en kg), repeticiones e impresiones personales.
  - Historial de marcas y progreso.

### 🐳 3. Servidor Backend Dockerizado & Switcher de URL Dinámico
- Servidor Backend desplegable con un solo comando usando **Docker** y **Docker Compose**.
- Conexión flexible desde la app a cualquier servidor o IP (`http://tu-servidor-vps.com:3000` o `http://172.16.3.X:3000`).
- Modal en la app con **prueba de ping/salud en vivo** (indicador verde de estado).
- Sincronización instantánea de clientes, ejercicios, rutinas y registros de peso.

---

## 🏗️ Arquitectura del Sistema

```mermaid
graph TD
    subgraph Cliente Movil [App Android Nativa - Kotlin Jetpack Compose]
        A[MainActivity - Scaffolding] --> B[Role Switcher: Coach / Client]
        B --> C[ClientDashboardScreen]
        B --> D[CoachDashboardScreen]
        B --> E[ExerciseCatalogScreen]
        C --> F[LogWeightModal - Subir Peso]
        D --> G[RoutineBuilderModal]
        A --> H[ServerConfigDialog & Switcher]
        H --> I[ServerRepository]
    end

    subgraph Docker Container [Servidor Dockerizado Node.js / Express]
        I -- HTTP/Retrofit --> J[API Gateway Server.js :3000]
        J --> K[/api/exercises]
        J --> L[/api/clients]
        J --> M[/api/routines/weekly]
        J --> N[/api/logs]
        J --> O[(gym_db.json Volume)]
    end
```

---

## 🛠️ Instalación y Despliegue

### 🚀 Instalación Rápida (Recomendado)

```bash
# Clonar repositorio
git clone https://github.com/albertodonaldonarvaez-cloud/gym-app.git
cd gym-app

# Linux / macOS — Ejecutar instalador
chmod +x install.sh
./install.sh

# Windows — Doble clic en install.bat o ejecutar:
.\install.bat
```

El instalador automáticamente:
1. ✅ Verifica que Docker esté instalado
2. ✅ Genera un archivo `.env` con secretos seguros
3. ✅ Construye y levanta los 3 servicios (PostgreSQL + Backend + Web)
4. ✅ Ejecuta migraciones y seed de datos
5. ✅ Espera hasta que el backend responda `/api/health`
6. ✅ Muestra las URLs de acceso y credenciales

### 🐳 Despliegue Manual con Docker Compose

```bash
cd gym-app

# Iniciar todos los servicios en segundo plano
docker compose up -d --build
```

### 📡 Servicios Desplegados

| Servicio | Puerto | URL |
|---|---|---|
| **Backend API** | `3002` | `http://tu-servidor:3002` |
| **Web Coach Panel** | `3005` | `http://tu-servidor:3005` |
| **PostgreSQL** | `5434` | `localhost:5434` |

### 🔑 Credenciales por Defecto

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@gymaura.com` | `GymAura2025!` |
| Coach | `coach@gymaura.com` | `Coach2025!` |
| Cliente | `cliente@gymaura.com` | `Client2025!` |

---

### 🔄 Actualizar el Servidor (cuando hay código nuevo)

> ⚠️ **`docker restart` NO actualiza el código.** Solo reinicia el contenedor con la imagen vieja.
> Para aplicar cambios del servidor siempre usar `--build`:

```bash
cd ~/gym-app && git pull origin main && docker compose up -d --build
```

### 🎬 Gestión de Media (GIFs/Videos de ejercicios)

```bash
# 1. Obtener token de admin
TOKEN=$(curl -s -X POST https://TU-SERVIDOR/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gymaura.com","password":"GymAura2025!"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. Ver estado de medias
curl https://TU-SERVIDOR/api/v1/admin/media-status \
  -H "Authorization: Bearer $TOKEN"

# 3. Descargar videos faltantes (yt-dlp en background)
curl -X POST https://TU-SERVIDOR/api/v1/admin/download-missing-media \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

## 📱 Aplicación Móvil Android (Kotlin)

El proyecto incluye el wrapper Gradle para compilación directa:

```bash
cd gym-app/android

# Compilar APK de depuración
./gradlew assembleDebug
```

El APK ejecutable se genera en:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📡 Referencia de API Endpoints

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Verificación de salud y estado del servidor |
| `POST` | `/api/v1/auth/login` | Login — devuelve JWT token |
| `GET` | `/api/exercises` | Lista de ejercicios (soporta `?category=` y `?search=`) |
| `POST` | `/api/exercises` | Crear un nuevo ejercicio en el catálogo (Coach) |
| `GET` | `/api/v1/routines/current-week` | Rutina semanal del cliente autenticado (con GIFs/instrucciones) |
| `GET` | `/api/clients` | Obtener lista de clientes registrados |
| `POST` | `/api/clients` | Registrar un nuevo cliente |
| `POST` | `/api/routines/weekly` | Guardar/Actualizar la rutina semanal de un cliente |
| `GET` | `/api/logs/:clientId` | Consultar marcas e historial de peso de un cliente |
| `POST` | `/api/logs` | Registrar una serie/peso cargado (Cliente) |
| `GET` | `/api/v1/admin/media-status` | Estado de descarga de GIFs/videos (Admin) |
| `POST` | `/api/v1/admin/download-missing-media` | Descargar videos faltantes con yt-dlp (Admin) |

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Desarrollado con 💙 para **TecTi Cloud Ecosystem**.
