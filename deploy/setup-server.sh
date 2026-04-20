#!/usr/bin/env bash
# setup-server.sh — Configura um VPS Ubuntu 24.04 do zero
#
# USO (como root ou com sudo):
#   bash deploy/setup-server.sh
#
# O que faz:
#   1. Atualiza o sistema
#   2. Instala Node.js 22 LTS, Nginx, Certbot, PM2
#   3. Cria usuário 'deploy' com acesso via sudo
#   4. Cria diretórios da aplicação com permissões corretas
#   5. Configura diretório de logs do PM2
#   6. Configura backup automático do banco de dados (cron)
#   7. Configura firewall UFW
#   8. Habilita atualizações automáticas de segurança

set -euo pipefail

# ── Cores ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[AVISO]${NC} $*"; }
error()   { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

[[ $EUID -eq 0 ]] || error "Execute como root: sudo bash deploy/setup-server.sh"

# ── 1. Atualizar sistema ─────────────────────────────────────────────────────
info "Atualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Dependências base ─────────────────────────────────────────────────────
info "Instalando dependências..."
apt-get install -y -qq curl git ufw unattended-upgrades apt-listchanges

# Node.js 22 LTS
if ! command -v node &>/dev/null; then
    info "Instalando Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
fi
info "Node.js $(node -v) instalado."

# Nginx
apt-get install -y -qq nginx
systemctl enable nginx

# Certbot (Let's Encrypt)
apt-get install -y -qq certbot python3-certbot-nginx

# PM2
if ! command -v pm2 &>/dev/null; then
    info "Instalando PM2..."
    npm install -g pm2 --silent
fi
info "PM2 $(pm2 -v) instalado."

# pm2-logrotate
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 50M 2>/dev/null || true
pm2 set pm2-logrotate:retain 7 2>/dev/null || true

# ── 3. Usuário deploy ────────────────────────────────────────────────────────
if ! id "deploy" &>/dev/null; then
    info "Criando usuário 'deploy'..."
    adduser --disabled-password --gecos "" deploy
    usermod -aG sudo deploy
    warn "IMPORTANTE: Configure autenticação por chave SSH para o usuário 'deploy'."
    warn "  ssh-copy-id deploy@SEU_IP"
else
    info "Usuário 'deploy' já existe."
fi

# ── 4. Diretórios da aplicação ───────────────────────────────────────────────
info "Criando estrutura de diretórios..."
mkdir -p /var/www/fluxodecaixa
mkdir -p /var/log/pm2
mkdir -p /backups/fluxodecaixa
chown -R deploy:deploy /var/www/fluxodecaixa
chown -R deploy:deploy /var/log/pm2
chown -R deploy:deploy /backups/fluxodecaixa
chmod 750 /backups/fluxodecaixa

# ── 5. Backup automático do banco de dados ───────────────────────────────────
info "Configurando backup automático (cron)..."
CRON_JOB="0 2 * * * deploy cp /var/www/fluxodecaixa/backend/data/cashflow.db /backups/fluxodecaixa/cashflow_\$(date +\\%Y\\%m\\%d).db 2>/dev/null; find /backups/fluxodecaixa -name '*.db' -mtime +30 -delete"
echo "$CRON_JOB" > /etc/cron.d/fluxodecaixa-backup
chmod 644 /etc/cron.d/fluxodecaixa-backup
info "Backup configurado: diário às 02h, mantém 30 dias."

# ── 6. Firewall UFW ──────────────────────────────────────────────────────────
info "Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3001/tcp   # porta do backend: só Nginx acessa internamente
echo "y" | ufw enable
info "Firewall ativo."

# ── 7. Atualizações automáticas de segurança ─────────────────────────────────
info "Habilitando atualizações automáticas de segurança..."
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ── 8. Hardening SSH ─────────────────────────────────────────────────────────
info "Recomendações para /etc/ssh/sshd_config:"
warn "  PasswordAuthentication no"
warn "  PermitRootLogin no"
warn "  PubkeyAuthentication yes"
warn "  Execute 'sudo systemctl reload ssh' após editar."

# ── Resumo ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Servidor configurado com sucesso!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Clone o repositório:"
echo "     git clone https://github.com/rodrigogbvasconcelos/fluxodecaixa.git /var/www/fluxodecaixa"
echo ""
echo "  2. Execute o deploy:"
echo "     sudo -u deploy bash /var/www/fluxodecaixa/deploy/deploy.sh"
echo ""
echo "  3. Configure o Nginx:"
echo "     sudo cp /var/www/fluxodecaixa/deploy/nginx.conf /etc/nginx/sites-available/fluxodecaixa"
echo "     sudo ln -s /etc/nginx/sites-available/fluxodecaixa /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  4. Obtenha o certificado HTTPS:"
echo "     sudo certbot --nginx -d SEU_DOMINIO.com.br"
