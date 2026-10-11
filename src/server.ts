import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);

const server = createApp().listen(port, () => {
  console.log(`champions-api listening on http://localhost:${String(port)}`);
});

// Container platforms (ECS, Docker) send SIGTERM before stopping a container.
// Stop accepting new connections and let in-flight requests finish first.
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
