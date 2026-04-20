# Deploy — Fluxo de Caixa

Guia completo para hospedar a aplicação em um VPS Ubuntu 24.04.

---

## Pré-requisitos

- VPS Ubuntu 24.04 LTS (mínimo 1GB RAM, 20GB disco)
- Domínio apontando para o IP do servidor (registro DNS tipo A)
- Acesso SSH como root

---

## 1. Configurar o servidor (uma única vez)

```bash
# No servidor, como root
bash /var/www/fluxodecaixa/deploy/setup-server.sh
```

O script instala: Node.js 22, Nginx, Certbot, PM2 e configura firewall.

---

## 2. Clonar o repositório

```bash
git clone https://github.com/rodrigogbvasconcelos/fluxodecaixa.git /var/www/fluxodecaixa
chown -R deploy:deploy /var/www/fluxodecaixa
```

---

## 3. Primeiro deploy

```bash
sudo -u deploy bash /var/www/fluxodecaixa/deploy/deploy.sh
```

O script vai pedir para editar o `backend/.env` se não existir.

### Valores obrigatórios no `backend/.env`:

```env
JWT_SECRET=<gerado automaticamente pelo deploy.sh>
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://SEU_DOMINIO.com.br
```

---

## 4. Configurar o Nginx

```bash
# Substituir SEU_DOMINIO.com.br no arquivo
sed -i 's/SEU_DOMINIO.com.br/meudominio.com.br/g' /var/www/fluxodecaixa/deploy/nginx.conf

# Ativar a configuração
sudo cp /var/www/fluxodecaixa/deploy/nginx.conf /etc/nginx/sites-available/fluxodecaixa
sudo ln -s /etc/nginx/sites-available/fluxodecaixa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Certificado HTTPS (gratuito)

```bash
sudo certbot --nginx -d meudominio.com.br
```

Certbot configura a renovação automática. Verificar com:

```bash
sudo certbot renew --dry-run
```

---

## 6. Atualizar após mudanças no código

```bash
bash /var/www/fluxodecaixa/deploy/update.sh
```

O update.sh faz backup do banco, baixa as mudanças, recompila e recarrega sem downtime.

---

## Comandos úteis

```bash
# Status do backend
pm2 status

# Logs em tempo real
pm2 logs fluxo-backend

# Monitor CPU/RAM
pm2 monit

# Reiniciar manualmente
pm2 restart fluxo-backend

# Status do Nginx
sudo systemctl status nginx

# Testar configuração do Nginx
sudo nginx -t

# Ver logs do Nginx
sudo tail -f /var/log/nginx/fluxodecaixa.error.log

# Listar backups do banco
ls -lh /backups/fluxodecaixa/
```

---

## Estrutura no servidor

```
/var/www/fluxodecaixa/
├── backend/
│   ├── dist/           ← compilado (gerado pelo deploy)
│   ├── data/
│   │   └── cashflow.db ← banco de dados (NUNCA apagar)
│   ├── uploads/        ← notas fiscais enviadas
│   └── .env            ← variáveis de produção (NUNCA commitar)
├── frontend/
│   └── dist/           ← build do Vite (servido pelo Nginx)
└── deploy/
    ├── nginx.conf
    ├── ecosystem.config.js
    ├── setup-server.sh
    ├── deploy.sh
    └── update.sh

/backups/fluxodecaixa/  ← backups automáticos diários do banco
/var/log/pm2/           ← logs do Node.js
/var/log/nginx/         ← logs do Nginx
```

---

## Segurança: checklist pós-deploy

- [ ] Trocar senha do admin padrão (`admin@empresa.com`)
- [ ] Confirmar que `NODE_ENV=production` no `.env`
- [ ] HTTPS ativo e redirecionando HTTP → HTTPS
- [ ] Porta 3001 inacessível externamente (`ufw status`)
- [ ] SSH configurado com chave, sem senha: `PasswordAuthentication no`
- [ ] Login root via SSH desabilitado: `PermitRootLogin no`
- [ ] Backups automáticos configurados (`crontab -l`)
