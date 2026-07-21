// PM2 Ecosystem Configuration File
// Manages the Learning Platform Node.js backend in production.
//
// Usage on the server:
//   cd /var/www/learning-platform-backend
//   pm2 start ecosystem.config.js --env production
//   pm2 save

module.exports = {
  apps: [{
    name: 'learning-platform-backend',
    script: 'src/server.js',

    // Instances
    instances: 1,        // Or 'max' to use all CPU cores
    exec_mode: 'fork',   // Or 'cluster' for load balancing

    // Environment variables (real secrets live in the .env file, not here)
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Behaviour
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.env'],
    max_memory_restart: '400M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    kill_timeout: 5000,

    source_map_support: true
  }]
};
