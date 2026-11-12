import { createApp } from './app.js';
import { type Config, loadConfig } from './config.js';

// Fail fast: refuse to start with missing or invalid environment variables.
// Print only the message (it names each bad variable); a stack trace adds noise.
let config: Config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const server = createApp().listen(config.PORT, () => {
  console.log(`champions-api listening on http://localhost:${String(config.PORT)}`);
});

// Container platforms (ECS, Docker) send SIGTERM before stopping a container.
// Stop accepting new connections and let in-flight requests finish first.
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
