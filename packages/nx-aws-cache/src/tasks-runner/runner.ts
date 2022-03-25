import { config as dotEnvConfig } from 'dotenv';
dotEnvConfig();

import defaultTaskRunner from '@nrwl/workspace/tasks-runners/default';
import { AffectedEvent } from '@nrwl/workspace/src/tasks-runner/tasks-runner';
import { from, Subject } from 'rxjs';

import { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';

function getOptions(options: AwsNxCacheOptions) {
  return {
    awsAccessKeyId: process.env.NX_AWS_ACCESS_KEY_ID,
    awsBucket: options.awsBucket ?? process.env.NX_AWS_BUCKET,
    awsRegion: options.awsRegion ?? process.env.NX_AWS_REGION,
    awsSecretAccessKey: process.env.NX_AWS_SECRET_ACCESS_KEY,
    awsProfile: options.awsProfile ?? process.env.NX_AWS_PROFILE,
    awsEndpoint: options.awsEndpoint ?? process.env.NX_AWS_ENDPOINT,
  };
}

// eslint-disable-next-line max-lines-per-function
export const tasksRunner = (
  tasks: Parameters<typeof defaultTaskRunner>[0],
  options: Parameters<typeof defaultTaskRunner>[1] & AwsNxCacheOptions,
  // eslint-disable-next-line no-magic-numbers
  context: Parameters<typeof defaultTaskRunner>[2],
) => {
  const awsOptions: AwsNxCacheOptions = getOptions(options);
  const logger = new Logger();

  try {
    if (process.env.NX_AWS_DISABLE === 'true') {
      logger.note('USING LOCAL CACHE (NX_AWS_DISABLE is set to true)');

      return defaultTaskRunner(tasks, options, context);
    }

    logger.note('USING REMOTE CACHE');

    const messages = new MessageReporter(logger);
    const remoteCache = new AwsCache(awsOptions, messages);
    const runnerWrapper = new Subject<AffectedEvent>(),
      runner$ = defaultTaskRunner(
        tasks,
        {
          ...options,
          remoteCache,
        },
        context,
      );

    from(runner$).subscribe({
      next: (value) => runnerWrapper.next(value),
      error: (err) => runnerWrapper.error(err),
      complete: async () => {
        await remoteCache.waitForStoreRequestsToComplete();
        messages.printMessages();
        runnerWrapper.complete();
      },
    });

    if (typeof runner$?.subscribe === 'function') {
      return runnerWrapper;
    }

    return runnerWrapper.toPromise();
  } catch (err) {
    logger.warn((err as Error).message);
    logger.note('USING LOCAL CACHE');

    return defaultTaskRunner(tasks, options, context);
  }
};

export default tasksRunner;
