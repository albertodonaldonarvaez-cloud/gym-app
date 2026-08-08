#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════════╗
# ║               GymAura Liquid Glass — Instalador v2.0                ║
# ║           Backend API + Web Coach Panel + PostgreSQL                ║
# ╚═══════════════════════════════════════════════════════════════════════╝

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ${BOLD}🏋️  GymAura Liquid Glass — Instalador Automático${NC}${BLUE}         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Pre-requisites Check ────────────────────────────────────────────────
echo -e "${YELLOW}[1/6]${NC} Verificando requisitos..."

command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker no está instalado. Instálalo desde https://docs.docker.com/get-docker/${NC}"; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}❌ Docker Compose no está disponible.${NC}"; exit 1; }

echo -e "${GREEN}  ✅ Docker encontrado: $(docker --version)${NC}"
echo -e "${GREEN}  ✅ Docker Compose disponible${NC}"

# ─── Environment Setup ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/6]${NC} Configurando variables de entorno..."

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "gymaura-jwt-$(date +%s)-$(head -c 16 /dev/urandom | xxd -p)")
    DB_PASSWORD="GymAura_$(openssl rand -hex 8 2>/dev/null || echo $RANDOM$RANDOM)"
    
    cat > "$ENV_FILE" << EOF
# ─── GymAura Environment Configuration ───────────────────────────────
# Generado automáticamente por el instalador

# PostgreSQL
POSTGRES_DB=gymaura
POSTGRES_USER=gymaura
POSTGRES_PASSWORD=${DB_PASSWORD}

# Backend API
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://gymaura:${DB_PASSWORD}@gymaura-db:5432/gymaura
JWT_SECRET=${JWT_SECRET}

# Web Coach Panel  
VITE_API_URL=
EOF
    echo -e "${GREEN}  ✅ Archivo .env creado con secretos seguros${NC}"
else
    echo -e "${GREEN}  ✅ Archivo .env ya existe, usando configuración existente${NC}"
fi

# ─── Stop existing containers ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/6]${NC} Deteniendo contenedores existentes (si los hay)..."
docker compose down 2>/dev/null || true
echo -e "${GREEN}  ✅ Entorno limpio${NC}"

# ─── Build & Start ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6]${NC} Construyendo e iniciando servicios..."
echo -e "     ${BLUE}(Esto puede tardar unos minutos la primera vez)${NC}"
echo ""

docker compose up -d --build

# ─── Wait for services ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6]${NC} Esperando que los servicios estén listos..."

MAX_RETRIES=30
RETRY=0
until docker compose exec -T gymaura-backend node -e "fetch('http://localhost:3000/api/health').then(r=>{if(r.ok)process.exit(0);else process.exit(1)}).catch(()=>process.exit(1))" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo -e "${RED}  ⚠️ El backend tardó más de lo esperado. Revisa los logs: docker compose logs gymaura-backend${NC}"
        break
    fi
    sleep 2
    echo -ne "\r  ⏳ Esperando backend... (${RETRY}/${MAX_RETRIES})"
done

if [ $RETRY -lt $MAX_RETRIES ]; then
    echo -e "\n${GREEN}  ✅ Backend API en línea${NC}"
fi

# ─── Show Status ────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6]${NC} Estado de los servicios:"
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# ─── Detect server IP ───────────────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "tu-servidor")

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ${BOLD}✅ ¡GymAura instalado exitosamente!${NC}${GREEN}                       ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🔗 ${BOLD}Backend API:${NC}     http://${SERVER_IP}:3002             ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🌐 ${BOLD}Web Coach Panel:${NC} http://${SERVER_IP}:3005             ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🗄️  ${BOLD}PostgreSQL:${NC}      localhost:5434                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📱 ${BOLD}En la App Android:${NC}                                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Configura el servidor como:                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     ${BLUE}http://${SERVER_IP}:3002${NC}                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📧 ${BOLD}Credenciales por defecto:${NC}                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Coach: coach@gymaura.com / GymAura2025!                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Cliente: cliente@gymaura.com / GymAura2025!                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Comandos útiles:${NC}"
echo -e "  docker compose logs -f        ${BLUE}# Ver logs en vivo${NC}"
echo -e "  docker compose restart         ${BLUE}# Reiniciar servicios${NC}"
echo -e "  docker compose down            ${BLUE}# Detener todo${NC}"
echo -e "  docker compose up -d           ${BLUE}# Iniciar de nuevo${NC}"
echo ""
