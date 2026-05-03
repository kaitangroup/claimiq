module.exports = {
  apps: [
    {
      name: 'claimiq',
      script: './dist/index.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4012,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4012,
      },
      error_file: '/var/log/claimiq/error.log',
      out_file: '/var/log/claimiq/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
