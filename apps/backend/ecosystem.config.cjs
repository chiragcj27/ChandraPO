const path = require('path');

module.exports = {
  name: 'backend',
  cwd: __dirname,
  script: path.join(__dirname, 'dist', 'index.js'),
  interpreter: 'node',
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: '500M',
  env: {
    NODE_ENV: 'production',
  },
};
