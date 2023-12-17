import { config as dotEnvConfig } from 'dotenv';

['.local.env', '.env.local', '.env'].forEach((file) => {
  dotEnvConfig({
    path: file,
  });
});

import { TaskStatus } from '@nx/workspace/src/tasks-runner/tasks-runner';
import { defaultTasksRunner } from '@nx/devkit';

import { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';

function getOptions(options: AwsNxCacheOptions) {
  return {
    awsAccessKeyId: process.env.NXCACHE_AWS_ACCESS_KEY_ID ?? options.awsAccessKeyId,
    awsSecretAccessKey: process.env.NXCACHE_AWS_SECRET_ACCESS_KEY ?? options.awsSecretAccessKey,
    awsProfile: process.env.NXCACHE_AWS_PROFILE ?? options.awsProfile,
    awsEndpoint: process.env.NXCACHE_AWS_ENDPOINT ?? options.awsEndpoint,
    awsRegion: process.env.NXCACHE_AWS_REGION ?? options.awsRegion,
    awsBucket: process.env.NXCACHE_AWS_BUCKET ?? options.awsBucket,
    awsForcePathStyle: process.env.NXCACHE_AWS_FORCE_PATH_STYLE
      ? process.env.NXCACHE_AWS_FORCE_PATH_STYLE === 'true'
      : options.awsForcePathStyle,
    encryptionFileKey:
      process.env.NX_CLOUD_ENCRYPTION_KEY ??
      process.env.NXCACHE_AWS_ENCRYPTION_KEY ??
      options.encryptionFileKey,
  };
}

// eslint-disable-next-line max-lines-per-function
export const tasksRunner = (
  tasks: Parameters<typeof defaultTasksRunner>[0],
  options: Parameters<typeof defaultTasksRunner>[1] & AwsNxCacheOptions,
  // eslint-disable-next-line no-magic-numbers
  context: Parameters<typeof defaultTasksRunner>[2],
) => {
  const awsOptions: AwsNxCacheOptions = getOptions(options);
  const logger = new Logger();

  try {
    if (process.env.NXCACHE_AWS_DISABLE === 'true') {
      if (!options.skipNxCache) {
        logger.note('USING LOCAL CACHE (NXCACHE_AWS_DISABLE is set to true)');
      }

      return defaultTasksRunner(tasks, options, context);
    }

    if (!options.skipNxCache) {
      logger.note('USING REMOTE CACHE');
    }

    const messages = new MessageReporter(logger);
    const remoteCache = new AwsCache(awsOptions, messages);

    const runner: Promise<{ [id: string]: TaskStatus }> = defaultTasksRunner(
      tasks,
      {
        ...options,
        remoteCache,
      },
      context,
    ) as Promise<{ [id: string]: TaskStatus }>;

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
