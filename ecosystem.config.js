module.exports = {
  apps: [
    {
      name: "sistem",
      script: "server.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      time: true,
    },
  ],
};
