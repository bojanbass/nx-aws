import { formatFiles, logger, readJson, type Tree, updateJson } from '@nx/devkit';

import type { InitGeneratorSchema } from './schema';

/** Nx 21 removed support for custom task runners. */
const FIRST_NX_VERSION_WITHOUT_TASKS_RUNNERS = 21;
const FIRST_NX_VERSION_WITH_DB_CACHE = 20;
const MIN_NX_VERSION = 16;

export function getNxMajorVersion(tree: Tree): number | undefined {
  if (!tree.exists('package.json')) {
    return undefined;
  }

  const { dependencies = {}, devDependencies = {} } = readJson(tree, 'package.json');
  const version =
    devDependencies.nx ??
    dependencies.nx ??
    devDependencies['@nx/workspace'] ??
    dependencies['@nx/workspace'] ??
    devDependencies['@nrwl/workspace'] ??
    dependencies['@nrwl/workspace'];
  const major = /\d+/u.exec(version ?? '')?.[0];

  return major ? Number.parseInt(major, 10) : undefined;
}

function updateNxJson(tree: Tree, options: InitGeneratorSchema, nxMajorVersion?: number): void {
  updateJson(tree, 'nx.json', (jsonContent) => {
    if (nxMajorVersion === FIRST_NX_VERSION_WITH_DB_CACHE) {
      // The Nx 20 database cache ignores custom remote caches.
      jsonContent.useLegacyCache = true;
    }

    const currentOptions = jsonContent.tasksRunnerOptions?.default?.options;

    jsonContent.tasksRunnerOptions = {
      default: {
        runner: '@nx-aws-plugin/nx-aws-cache',
        options: {
          ...currentOptions,
          ...(options.awsAccessKeyId ? { awsAccessKeyId: options.awsAccessKeyId } : {}),
          ...(options.awsSecretAccessKey ? { awsSecretAccessKey: options.awsSecretAccessKey } : {}),
          ...(options.awsProfile ? { awsProfile: options.awsProfile } : {}),
          ...(options.awsEndpoint ? { awsEndpoint: options.awsEndpoint } : {}),
          ...(options.awsRegion ? { awsRegion: options.awsRegion } : {}),
          ...(options.awsBucket ? { awsBucket: options.awsBucket } : {}),
          ...(options.awsForcePathStyle ? { awsForcePathStyle: options.awsForcePathStyle } : {}),
          ...(options.encryptionFileKey ? { encryptionFileKey: options.encryptionFileKey } : {}),
        },
      },
    };

    return jsonContent;
  });
}

function logServerSetup(nxMajorVersion: number): void {
  logger.info(
    [
      `Nx ${nxMajorVersion} does not support custom task runners, so nx.json was not modified.`,
      'Use the bundled remote cache server instead (implements the Nx self-hosted remote cache API):',
      '',
      '  1. Start the server with the NXCACHE_AWS_* variables and an access token:',
      '     NXCACHE_AWS_BUCKET=my-bucket NXCACHE_SERVER_ACCESS_TOKEN=<token> npx nx-aws-cache-server',
      '  2. Point Nx at it:',
      '     NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000',
      '     NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<token>',
      '',
      'See https://github.com/bojanbass/nx-aws#nx-21-and-later for details.',
    ].join('\n'),
  );
}

export default async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const nxMajorVersion = getNxMajorVersion(tree);

  if (nxMajorVersion !== undefined && nxMajorVersion >= FIRST_NX_VERSION_WITHOUT_TASKS_RUNNERS) {
    logServerSetup(nxMajorVersion);
    return;
  }

  if (nxMajorVersion === undefined || nxMajorVersion < MIN_NX_VERSION) {
    logger.warn('You must install Nx version 16 or later to enable the plugin.');
  }

  updateNxJson(tree, options, nxMajorVersion);

  await formatFiles(tree);
}
