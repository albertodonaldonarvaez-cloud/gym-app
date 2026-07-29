# 🏋️‍♂️ GymAura Liquid Glass Edition

<p align="center">
  <img src="https://img.shields.io/badge/Kotlin-1.9.23-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin">
  <img src="https://img.shields.io/badge/Jetpack%20Compose-2024.05.00-4285F4?style=for-the-badge&logo=android&logoColor=white" alt="Jetpack Compose">
  <img src="https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4.19-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/Design-Apple%20Liquid%20Glass-007AFF?style=for-the-badge&logo=apple&logoColor=white" alt="Apple Liquid Glass">
</p>

---

## 📌 Descripción General

**GymAura Liquid** es una aplicación móvil nativa desarrollada en **Kotlin** con **Jetpack Compose**, acompañada de una API **RESTful Backend en Node.js**. 

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

### 🌐 3. Servidor Backend & Switcher de URL Dinámico
- Conexión flexible a cualquier servidor o IP (`http://tu-servidor-vps.com:3000` o `http://172.16.3.X:3000`).
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

    subgraph Backend [Servidor REST API Node.js / Express]
        I -- HTTP/Retrofit --> J[API Gateway Server.js]
        J --> K[/api/exercises]
        J --> L[/api/clients]
        J --> M[/api/routines/weekly]
        J --> N[/api/logs]
        J --> O[(gym_db.json Persistence)]
    end
```

---

## 🛠️ Instalación y Configuración

### 1. Servidor Backend (Node.js)

```bash
# Clonar repositorio
git clone https://github.com/albertodonaldonarvaez-cloud/gym-app.git
cd gym-app/server

# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

El servidor quedará activo en `http://0.0.0.0:3000`.

### 2. Aplicación Móvil Android (Kotlin)

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
| `GET` | `/api/exercises` | Lista de ejercicios (soporta `?category=` y `?search=`) |
| `POST` | `/api/exercises` | Crear un nuevo ejercicio en el catálogo (Coach) |
| `GET` | `/api/clients` | Obtener lista de clientes registrados |
| `POST` | `/api/clients` | Registrar un nuevo cliente |
| `GET` | `/api/routines/weekly/:clientId` | Consultar la rutina semanal de un cliente |
| `POST` | `/api/routines/weekly` | Guardar/Actualizar la rutina semanal de un cliente |
| `GET` | `/api/logs/:clientId` | Consultar marcas e historial de peso de un cliente |
| `POST` | `/api/logs` | Registrar una serie/peso cargado (Cliente) |

---

## 🎨 Paleta de Colores Apple Liquid Glass

- **Glass Surface White**: `rgba(255, 255, 255, 0.80)`
- **Glass Border White**: `rgba(255, 255, 255, 0.60)`
- **Apple Blue Accent**: `#007AFF`
- **Apple Teal Accent**: `#30B0C7`
- **Apple Indigo Accent**: `#5856D6`
- **Apple Emerald Accent**: `#34C759`

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Desarrollado con 💙 para **TecTi Cloud Ecosystem**.
