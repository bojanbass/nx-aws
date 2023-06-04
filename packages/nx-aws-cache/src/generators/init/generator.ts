import { formatFiles, logger, Tree, updateJson, readRootPackageJson } from '@nx/devkit';

import { InitGeneratorSchema } from './schema';

function isCompatibleVersion() {
  const packageJson = readRootPackageJson();
  let version =
    packageJson.dependencies?.['@nx/workspace'] ??
    packageJson.devDependencies?.['@nx/workspace'] ??
    packageJson.dependencies?.['@nrwl/workspace'] ??
    packageJson.devDependencies?.['@nrwl/workspace'];

  if (!version) {
    throw new Error(`You must install Nx to enable Storage Cache`);
  }

  if (version.startsWith('^') || version.startsWith('~')) {
    version = version.substr(1);
  }

  const [major] = version.split('.');
  const majorNumber = Number.parseInt(major, 10);

  if (isNaN(majorNumber)) {
    return false;
  }

  // eslint-disable-next-line no-magic-numbers
  if (majorNumber >= 16) {
    return true;
  }

  return false;
}

function updateNxJson(tree: Tree, options: InitGeneratorSchema): void {
  updateJson(tree, 'nx.json', (jsonContent) => {
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
        },
      },
    };

    return jsonContent;
  });
}

// eslint-disable-next-line func-names
export default async function (tree: Tree, options: InitGeneratorSchema) {
  if (!isCompatibleVersion()) {
    logger.warn('You must install Nx version 16 or later to enable the plugin.');
  }

  updateNxJson(tree, options);

  await formatFiles(tree);
}
