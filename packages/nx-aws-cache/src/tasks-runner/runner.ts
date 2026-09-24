import '../load-env';

import { defaultTasksRunner } from '@nx/devkit';

import { resolveAwsOptions } from '../s3';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';
import type { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';

const FIRST_NX_VERSION_WITH_DB_CACHE = 20;

/**
 * Starting with Nx 20 the database cache ignores custom remote caches, unless the legacy cache is enabled.
 */
function isRemoteCacheIgnored(context: Parameters<typeof defaultTasksRunner>[2]): boolean {
  if (process.env.NX_DISABLE_DB === 'true' || process.env.NX_DB_CACHE === 'false') {
    return false;
  }

  try {
    const nxMajorVersion = Number.parseInt(require('nx/package.json').version, 10);
    const { useLegacyCache } = (context?.nxJson ?? {}) as { useLegacyCache?: boolean };

    return nxMajorVersion >= FIRST_NX_VERSION_WITH_DB_CACHE && !useLegacyCache;
  } catch {
    return false;
  }
}

export const tasksRunner = (
  tasks: Parameters<typeof defaultTasksRunner>[0],
  options: Parameters<typeof defaultTasksRunner>[1] & AwsNxCacheOptions,
  // eslint-disable-next-line no-magic-numbers
  context: Parameters<typeof defaultTasksRunner>[2],
) => {
  const awsOptions: AwsNxCacheOptions = resolveAwsOptions(options);
  const logger = new Logger();

  try {
    if (process.env.NXCACHE_AWS_DISABLE === 'true') {
      if (!options.skipNxCache) {
        logger.note('USING LOCAL CACHE (NXCACHE_AWS_DISABLE is set to true)');
      }

      return defaultTasksRunner(tasks, options, context);
    }

    if (isRemoteCacheIgnored(context)) {
      logger.warn(
        'REMOTE CACHE IS IGNORED BY NX: set "useLegacyCache": true in nx.json, or use nx-aws-cache-server (Nx >= 20.8)',
      );
    } else if (!options.skipNxCache) {
      logger.note('USING REMOTE CACHE');
    }

    const messages = new MessageReporter(logger);
    const remoteCache = new AwsCache(awsOptions, messages);

    const runner = defaultTasksRunner(
      tasks,
      {
        ...options,
        remoteCache,
      },
      context,
    ) as Promise<Record<string, unknown>>;

    runner.finally(async () => {
      await remoteCache.waitForStoreRequestsToComplete();
      messages.printMessages();
    });

    return runner;
  } catch (err) {
    logger.warn((err as Error).message);
    logger.note('USING LOCAL CACHE');

    return defaultTasksRunner(tasks, options, context);
  }
};

export default tasksRunner;
