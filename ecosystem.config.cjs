module.exports = {
  apps: [
    {
      name: 'rescue-study-guides',
      script: 'app.js',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
    }
  ]
}
