import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { join } from 'path';

import { NxAwsCacheSchematicSchema } from './schema';

describe('nx-aws-cache schematic', () => {
  let appTree: Tree;

  const options: NxAwsCacheSchematicSchema = { name: 'test' },
    testRunner = new SchematicTestRunner(
      '@nx-aws/nx-aws-cache',
      join(__dirname, '../../../collection.json'),
    );

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should run successfully', async () => {
    await expect(
      testRunner.runSchematicAsync('nx-aws-cache', options, appTree).toPromise(),
    ).resolves.not.toThrowError();
  });
});
