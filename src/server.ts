import { createApp } from './app.js';
import { type Config, loadConfig } from './config.js';
import { createLogger } from './logger.js';

// Fail fast: refuse to start with missing or invalid environment variables.
// Print only the message (it names each bad variable); a stack trace adds noise.
// This uses console.error because the logger can't be built without valid config.
let config: Config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = createLogger(config);

const server = createApp(logger).listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'server listening');
});

// Container platforms (ECS, Docker) send SIGTERM before stopping a container.
// Stop accepting new connections and let in-flight requests finish first.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
