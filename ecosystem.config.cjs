module.exports = {
  apps: [
    {
      name: 'rescue-study-guides',
      script: 'app.js',
      cwd: '/home/user/webapp',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '300M',
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
}
