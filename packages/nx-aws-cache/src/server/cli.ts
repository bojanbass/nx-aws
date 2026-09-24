#!/usr/bin/env node
import '../load-env';

import { resolveAwsOptions } from '../s3';
import { createCacheServer } from './cache-server';

const DEFAULT_PORT = 3000;

function log(message: string): void {
  console.log(`[nx-aws-cache-server] ${new Date().toISOString()} ${message}`);
}

const verbose = process.env.NXCACHE_VERBOSE_LOGGING === 'true';
const port = Number(process.env.NXCACHE_SERVER_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const host = process.env.NXCACHE_SERVER_HOST ?? '127.0.0.1';
const maxUploadBytes = process.env.NXCACHE_SERVER_MAX_UPLOAD_BYTES
  ? Number(process.env.NXCACHE_SERVER_MAX_UPLOAD_BYTES)
  : undefined;

try {
  const server = createCacheServer({
    ...resolveAwsOptions(),
    accessToken: process.env.NXCACHE_SERVER_ACCESS_TOKEN,
    readOnlyAccessToken: process.env.NXCACHE_SERVER_READ_ONLY_ACCESS_TOKEN,
    maxUploadBytes,
    log: verbose ? log : (message) => message.startsWith('ERROR') && log(message),
  });

  server.listen(port, host, () => log(`Listening on http://${host}:${port}`));

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      log(`Received ${signal}, shutting down`);
      server.close(() => process.exit(0));
      server.closeIdleConnections();
    });
  }
} catch (err) {
  log((err as Error).message);
  process.exit(1);
}
