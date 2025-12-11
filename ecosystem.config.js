module.exports = {
  apps: [{
    name: 'model-registry-api',
    script: './app/backend/src/server.js',
    cwd: '/opt/myapp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3100
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
