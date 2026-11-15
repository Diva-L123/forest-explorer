'use strict';

// Forwarding entry point to modular server
const { server, startServer } = require('./server/index');

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  startServer(PORT);
}

module.exports = { server, startServer };
