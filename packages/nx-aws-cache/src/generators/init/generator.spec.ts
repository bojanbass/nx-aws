import { readJson, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import generator, { getNxMajorVersion } from './generator';
import type { InitGeneratorSchema } from './schema';

describe('init generator', () => {
  let appTree: Tree;
  const options: InitGeneratorSchema = {
    awsRegion: 'eu-central-1',
    awsBucket: 'bucket-name',
  };

  function setNxVersion(version: string, dependency = 'nx') {
    writeJson(appTree, 'package.json', { devDependencies: { [dependency]: version } });
  }

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should detect the Nx major version', () => {
    setNxVersion('^20.8.1');
    expect(getNxMajorVersion(appTree)).toBe(20);

    setNxVersion('~16.10.0', '@nrwl/workspace');
    expect(getNxMajorVersion(appTree)).toBe(16);

    setNxVersion('latest');
    expect(getNxMajorVersion(appTree)).toBeUndefined();
  });

  describe('Nx < 21', () => {
    beforeEach(() => setNxVersion('20.8.0'));

    it('should add @nx-aws-plugin/nx-aws-cache to nx.json', async () => {
      await generator(appTree, options);

      const nxJson = readJson(appTree, 'nx.json');

      expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
      expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBe('eu-central-1');
      expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBe('bucket-name');
      expect(nxJson.useLegacyCache).toBe(true);
    });

    it('should add @nx-aws-plugin/nx-aws-cache with no aws options to nx.json', async () => {
      await generator(appTree, {});

      const nxJson = readJson(appTree, 'nx.json');

      expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
      expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBeUndefined();
      expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBeUndefined();
    });
  });

  it('should not enable the legacy cache for Nx < 20', async () => {
    setNxVersion('19.8.0');

    await generator(appTree, options);

    const nxJson = readJson(appTree, 'nx.json');
    expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
    expect(nxJson.useLegacyCache).toBeUndefined();
  });

  it('should not configure a custom task runner for Nx >= 21', async () => {
    setNxVersion('^23.2.1');

    await generator(appTree, options);

    expect(readJson(appTree, 'nx.json').tasksRunnerOptions).toBeUndefined();
  });
});
