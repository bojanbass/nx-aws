import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';

import generator from './generator';
import { InitGeneratorSchema } from './schema';

const AFTER_ALL_TIMEOUT = 1000;

describe('init generator', () => {
  let appTree: Tree;
  const options: InitGeneratorSchema = {
    awsRegion: 'eu-central-1',
    awsBucket: 'bucket-name',
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  afterAll((done) => {
    // Fix issue with load file after jest finished
    setTimeout(done, AFTER_ALL_TIMEOUT);
  });

  it('should add @nx-aws-plugin/nx-aws-cache to nx.json', () => {
    let nxJson = readJson(appTree, 'nx.json');
    expect(nxJson.tasksRunnerOptions.default.runner).toBe('nx/tasks-runners/default');

    generator(appTree, options);

    nxJson = readJson(appTree, 'nx.json');

    expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
    expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBe('eu-central-1');
    expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBe('bucket-name');
  });

  it('should add @nx-aws-plugin/nx-aws-cache with no aws options to nx.json', () => {
    let nxJson = readJson(appTree, 'nx.json');
    expect(nxJson.tasksRunnerOptions.default.runner).toBe('nx/tasks-runners/default');

    generator(appTree, {});

    nxJson = readJson(appTree, 'nx.json');

    expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
    expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBeUndefined();
    expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBeUndefined();
  });
});
