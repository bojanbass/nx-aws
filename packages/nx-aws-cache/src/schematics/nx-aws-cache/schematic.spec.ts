import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree, readJson } from '@nrwl/devkit';

import { NxAwsCacheSchematicSchema } from './schema';
import generator from './schematic';

describe('nx-aws-cache schematic', () => {
  let appTree: Tree;

  const options: NxAwsCacheSchematicSchema = {
    awsRegion: 'eu-central-1',
    awsBucket: 'bucket-name',
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should run successfully', () => {
    let nxJson = readJson(appTree, 'nx.json');
    expect(nxJson.tasksRunnerOptions.default.runner).toBe('nx/tasks-runners/default');

    generator(appTree, options);

    nxJson = readJson(appTree, 'nx.json');

    expect(nxJson.tasksRunnerOptions.default.runner).toBe('@nx-aws-plugin/nx-aws-cache');
    expect(nxJson.tasksRunnerOptions.default.options.awsRegion).toBe('eu-central-1');
    expect(nxJson.tasksRunnerOptions.default.options.awsBucket).toBe('bucket-name');
  });
});
