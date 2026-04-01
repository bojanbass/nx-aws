import { type Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import generator from './generator';
import type { InitGeneratorSchema } from './schema';

describe('init generator', () => {
  let appTree: Tree;
  const options: InitGeneratorSchema = {
    awsRegion: 'eu-central-1',
    awsBucket: 'bucket-name',
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should add @nx-aws-plugin/nx-aws-cache to nx.json', async () => {
    await generator(appTree, options);

    const nxJson = readJson(appTree, 'nx.json');

    expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
    expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBe('eu-central-1');
    expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBe('bucket-name');
  });

  it('should add @nx-aws-plugin/nx-aws-cache with no aws options to nx.json', async () => {
    await generator(appTree, {});

    const nxJson = readJson(appTree, 'nx.json');

    expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
    expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBeUndefined();
    expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBeUndefined();
  });
});
