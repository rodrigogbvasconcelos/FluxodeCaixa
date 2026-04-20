#!/usr/bin/env bash
# update.sh — Atualiza a aplicação sem perder dados
#
# USO (no servidor, como usuário deploy):
#   bash /var/www/fluxodecaixa/deploy/update.sh
#
# O que faz:
#   1. Faz backup do banco antes de atualizar
#   2. Baixa o código mais recente (git pull)
#   3. Reinstala dependências se package-lock mudou
#   4. Recompila backend e frontend
#   5. Recarrega o PM2 (zero downtime)

set -euo pipefail

APP_DIR="/var/www/fluxodecaixa"
BACKUP_DIR="/backups/fluxodecaixa"
DB_FILE="$APP_DIR/backend/data/cashflow.db"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn()  { echo -e "${YELLOW}[AVISO]${NC} $*"; }
error() { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

cd "$APP_DIR"

# ── 1. Backup do banco antes de qualquer mudança ─────────────────────────────
if [[ -f "$DB_FILE" ]]; then
    BACKUP_FILE="$BACKUP_DIR/cashflow_pre_update_$(date +%Y%m%d_%H%M%S).db"
    info "Criando backup: $BACKUP_FILE"
    mkdir -p "$BACKUP_DIR"
    cp "$DB_FILE" "$BACKUP_FILE"
    info "Backup criado com sucesso."
fi

# ── 2. Guardar hash do package-lock para detectar mudanças ──────────────────
OLD_LOCK_HASH=$(md5sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")

# ── 3. Atualizar código ──────────────────────────────────────────────────────
info "Baixando atualizações do Git..."
git fetch origin
git pull origin main
info "Código atualizado."

# ── 4. Reinstalar dependências somente se necessário ────────────────────────
NEW_LOCK_HASH=$(md5sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")
if [[ "$OLD_LOCK_HASH" != "$NEW_LOCK_HASH" ]]; then
    info "package-lock.json mudou — reinstalando dependências..."
    npm install --ignore-scripts 2>&1 | tail -3
else
    info "Dependências sem mudanças — pulando npm install."
fi

# ── 5. Recompilar ────────────────────────────────────────────────────────────
info "Recompilando backend..."
npm run build --workspace=backend

info "Recompilando frontend..."
npm run build --workspace=frontend

# ── 6. Recarregar PM2 (zero downtime) ───────────────────────────────────────
info "Recarregando backend (zero downtime)..."
pm2 reload fluxo-backend || pm2 start deploy/ecosystem.config.js --env production
pm2 save

# ── Resumo ───────────────────────────────────────────────────────────────────
echo ""
pm2 show fluxo-backend 2>/dev/null | grep -E "status|uptime|restarts|memory" || true
echo ""
info "Atualização concluída!"
echo "  Logs: pm2 logs fluxo-backend"
