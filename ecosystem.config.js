// PM2 Ecosystem Config for Hostinger Deployment
module.exports = {
  apps: [
    {
      name: 'rescue-study-guides',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
    }
  ]
};
