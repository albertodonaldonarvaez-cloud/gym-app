@echo off
chcp 65001 >nul 2>nul
setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║   🏋️ GymAura Liquid Glass — Instalador Automatico v2.0      ║
echo ║          Backend API + Web Coach Panel + PostgreSQL          ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

:: ─── Pre-requisites Check ──────────────────────────────────────────
echo [1/5] Verificando requisitos...

where docker >nul 2>nul
if errorlevel 1 (
    echo ❌ Docker no esta instalado. Instalalo desde https://docs.docker.com/get-docker/
    pause
    exit /b 1
)

echo   ✅ Docker encontrado

:: ─── Stop existing containers ──────────────────────────────────────
echo.
echo [2/5] Deteniendo contenedores existentes...
docker compose down 2>nul
echo   ✅ Entorno limpio

:: ─── Build ^& Start ────────────────────────────────────────────────
echo.
echo [3/5] Construyendo e iniciando servicios...
echo      (Esto puede tardar unos minutos la primera vez)
echo.

docker compose up -d --build

if errorlevel 1 (
    echo ❌ Error al iniciar los servicios. Revisa los logs con: docker compose logs
    pause
    exit /b 1
)

:: ─── Wait for services ─────────────────────────────────────────────
echo.
echo [4/5] Esperando que los servicios esten listos...

set RETRIES=0
:wait_loop
if !RETRIES! geq 30 (
    echo   ⚠️ El backend tardo mas de lo esperado. Revisa: docker compose logs gymaura-backend
    goto :show_status
)
timeout /t 3 /nobreak >nul
docker compose exec -T gymaura-backend node -e "fetch('http://localhost:3000/api/health').then(r=>{if(r.ok)process.exit(0);else process.exit(1)}).catch(()=>process.exit(1))" >nul 2>nul
if errorlevel 1 (
    set /a RETRIES+=1
    echo   ⏳ Esperando backend... (!RETRIES!/30)
    goto :wait_loop
)

echo   ✅ Backend API en linea

:show_status
:: ─── Show Status ───────────────────────────────────────────────────
echo.
echo [5/5] Estado de los servicios:
echo.
docker compose ps

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║   ✅ GymAura instalado exitosamente!                         ║
echo ╠═══════════════════════════════════════════════════════════════╣
echo ║                                                               ║
echo ║  🔗 Backend API:     http://localhost:3002                    ║
echo ║  🌐 Web Coach Panel: http://localhost:3005                    ║
echo ║  🗄️  PostgreSQL:      localhost:5434                          ║
echo ║                                                               ║
echo ║  📱 En la App Android:                                       ║
echo ║     Configura el servidor como:                               ║
echo ║     http://TU-IP-LOCAL:3002                                   ║
echo ║                                                               ║
echo ║  📧 Credenciales por defecto:                                 ║
echo ║     Coach: coach@gymaura.com / GymAura2025!                   ║
echo ║     Cliente: cliente@gymaura.com / GymAura2025!               ║
echo ║                                                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Comandos utiles:
echo   docker compose logs -f        # Ver logs en vivo
echo   docker compose restart         # Reiniciar servicios
echo   docker compose down            # Detener todo
echo   docker compose up -d           # Iniciar de nuevo
echo.
pause
