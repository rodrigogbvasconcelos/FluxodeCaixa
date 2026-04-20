// PM2 — Gerenciador de processos Node.js
//
// Comandos úteis:
//   pm2 start deploy/ecosystem.config.js   → inicia
//   pm2 reload fluxo-backend               → reload sem downtime
//   pm2 stop fluxo-backend                 → para
//   pm2 logs fluxo-backend                 → logs em tempo real
//   pm2 monit                              → monitor de CPU/RAM
//   pm2 startup                            → configura auto-start no boot
//   pm2 save                               → salva lista de processos

module.exports = {
  apps: [
    {
      name: 'fluxo-backend',
      script: 'dist/index.js',
      cwd: '/var/www/fluxodecaixa/backend',

      // Reiniciar automaticamente se travar ou consumir muita RAM
      watch: false,
      max_memory_restart: '300M',

      // Reiniciar após falhas (backoff exponencial até 10s)
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '5s',

      // Variáveis de ambiente de produção
      // Os valores reais ficam no arquivo backend/.env — NÃO colocar segredos aqui
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      // Logs
      out_file: '/var/log/pm2/fluxo-backend-out.log',
      error_file: '/var/log/pm2/fluxo-backend-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Rotação de logs (requer: pm2 install pm2-logrotate)
      // pm2 set pm2-logrotate:max_size 50M
      // pm2 set pm2-logrotate:retain 7
    },
  ],
};
