module.exports = {
  apps: [
    {
      name: "cbt-exam-system",
      script: "dist/server.cjs",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "500M",
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
