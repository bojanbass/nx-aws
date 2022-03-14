import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { join } from 'path';

import { NxAwsCacheSchematicSchema } from './schema';

describe('nx-aws-cache schematic', () => {
  let appTree: Tree;

  const options: NxAwsCacheSchematicSchema = {
      awsRegion: 'eu-central-1',
      awsBucket: 'bucket-name',
    },
    testRunner = new SchematicTestRunner(
      '@nx-aws-plugin/nx-aws-cache',
      join(__dirname, '../../../collection.json'),
    );

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should run successfully', async () => {
    await expect(
      testRunner.runSchematicAsync('init', options, appTree).toPromise(),
    ).resolves.not.toThrowError();
  });
});
