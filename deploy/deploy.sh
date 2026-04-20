#!/usr/bin/env bash
# deploy.sh — Faz o build e sobe a aplicação no servidor
#
# USO (no servidor, como usuário deploy):
#   bash /var/www/fluxodecaixa/deploy/deploy.sh
#
# Na primeira vez, preencha o arquivo backend/.env antes de executar.
# Em atualizações seguintes, o .env existente é preservado.

set -euo pipefail

APP_DIR="/var/www/fluxodecaixa"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# ── Cores ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn()  { echo -e "${YELLOW}[AVISO]${NC} $*"; }
error() { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

cd "$APP_DIR"

# ── 1. Verificar .env ────────────────────────────────────────────────────────
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    warn "Arquivo backend/.env não encontrado."
    warn "Criando a partir do exemplo — EDITE antes de continuar."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    # Gerar JWT_SECRET automaticamente
    JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s|your-secret-here-min-32-chars|$JWT|" "$BACKEND_DIR/.env"
    warn ""
    warn "  ➜ Edite agora: nano $BACKEND_DIR/.env"
    warn "    - Defina NODE_ENV=production"
    warn "    - Defina FRONTEND_URL=https://SEU_DOMINIO.com.br"
    warn ""
    read -rp "Pressione ENTER após editar o .env para continuar o deploy..."
fi

# Validar que .env está configurado para produção
NODE_ENV_VAL=$(grep -E '^NODE_ENV=' "$BACKEND_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')
if [[ "$NODE_ENV_VAL" != "production" ]]; then
    warn "NODE_ENV não é 'production' no .env. Continuando mesmo assim..."
fi

# ── 2. Instalar dependências ─────────────────────────────────────────────────
info "Instalando dependências do backend..."
npm install --workspace=backend --ignore-scripts 2>&1 | tail -3

info "Instalando dependências do frontend..."
npm install --workspace=frontend --ignore-scripts 2>&1 | tail -3

# ── 3. Build ─────────────────────────────────────────────────────────────────
info "Compilando backend (TypeScript)..."
npm run build --workspace=backend

info "Compilando frontend (Vite)..."
npm run build --workspace=frontend

# ── 4. Garantir diretórios de dados ─────────────────────────────────────────
info "Verificando diretórios de dados..."
mkdir -p "$BACKEND_DIR/data"
mkdir -p "$BACKEND_DIR/uploads"
chmod 750 "$BACKEND_DIR/data"
chmod 750 "$BACKEND_DIR/uploads"

# ── 5. PM2 — inicia ou recarrega sem downtime ────────────────────────────────
info "Iniciando/recarregando backend com PM2..."

if pm2 describe fluxo-backend &>/dev/null; then
    pm2 reload deploy/ecosystem.config.js --env production
    info "Backend recarregado (zero downtime)."
else
    pm2 start deploy/ecosystem.config.js --env production
    pm2 startup | tail -1 | bash 2>/dev/null || true
    pm2 save
    info "Backend iniciado."
fi

# ── 6. Status final ──────────────────────────────────────────────────────────
echo ""
pm2 show fluxo-backend 2>/dev/null | grep -E "status|uptime|restarts|memory|cpu" || true
echo ""
info "Deploy concluído com sucesso!"
echo ""
echo "  Frontend em: $FRONTEND_DIR/dist"
echo "  Backend  em: $BACKEND_DIR/dist/index.js"
echo ""
echo "Verifique os logs com: pm2 logs fluxo-backend"
