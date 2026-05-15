module.exports = {
  apps: [
    {
      name: "sys-monitor-web",
      script: "server/index.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      time: true,
    },
  ],
};
