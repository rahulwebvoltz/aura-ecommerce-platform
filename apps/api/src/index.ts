import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createContext } from './server.js';

const env = parseEnv(process.env);
const ctx = createContext(env);
const app = createApp(ctx);

const server = app.listen(env.PORT, () => {
  ctx.logger.info(
    { port: env.PORT, razorpay: ctx.razorpay !== null },
    `API listening on http://localhost:${String(env.PORT)}`,
  );
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  ctx.logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(() => {
    ctx.prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        ctx.logger.error({ err: error }, 'Failed to disconnect from the database');
        process.exit(1);
      });
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
