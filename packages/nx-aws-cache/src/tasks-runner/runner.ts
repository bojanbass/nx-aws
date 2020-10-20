/* eslint-disable no-magic-numbers */

import { config as dotEnvConfig } from 'dotenv';
dotEnvConfig();

import defaultTaskRunner from '@nrwl/workspace/tasks-runners/default';
import { AffectedEvent } from '@nrwl/workspace/src/tasks-runner/tasks-runner';
import { Subject } from 'rxjs';

import { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';

export const tasksRunner = (
  tasks: Parameters<typeof defaultTaskRunner>[0],
  options: Parameters<typeof defaultTaskRunner>[1] & AwsNxCacheOptions,
  context: Parameters<typeof defaultTaskRunner>[2],
): ReturnType<typeof defaultTaskRunner> => {
  const awsOptions: AwsNxCacheOptions = {
      awsAccessKeyId: options.awsAccessKeyId ?? process.env.NX_AWS_ACCESS_KEY_ID,
      awsBucket: options.awsBucket ?? process.env.NX_AWS_BUCKET,
      awsRegion: options.awsRegion ?? process.env.NX_AWS_REGION,
      awsSecretAccessKey: options.awsSecretAccessKey ?? process.env.NX_AWS_SECRET_ACCESS_KEY,
    },
    logger = new Logger();

  try {
    AwsCache.checkConfig(awsOptions);

    logger.note('USING REMOTE CACHE');

    const messages = new MessageReporter(logger),
      remoteCache = new AwsCache(awsOptions, messages),
      runnerWrapper = new Subject<AffectedEvent>(),
      runner$ = defaultTaskRunner(
        tasks,
        {
          ...options,
          remoteCache,
        },
        context,
      );

    runner$.subscribe({
      next: (value) => runnerWrapper.next(value),
      error: (err) => runnerWrapper.error(err),
      complete: async () => {
        await remoteCache.waitForStoreRequestsToComplete();
        messages.printMessages();
        runnerWrapper.complete();
      },
    });

    return runnerWrapper;
  } catch (err) {
    logger.warn(err.message);
    logger.note('USING LOCAL CACHE');

    return defaultTaskRunner(tasks, options, context);
  }
};

export default tasksRunner;
