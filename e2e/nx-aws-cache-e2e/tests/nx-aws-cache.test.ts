import { ensureNxProject, readJson, runNxCommandAsync } from '@nrwl/nx-plugin/testing';
describe('nx-aws-cache e2e', () => {
  it('should create nx-aws-cache', async (done) => {
    ensureNxProject('@nx-aws-plugin/nx-aws-cache', 'dist/packages/nx-aws-cache');
    await runNxCommandAsync(
      `generate @nx-aws-plugin/nx-aws-cache:init --awsRegion=eu-central-1 --awsBucket=bucket-name/cache-folder`,
    );

    const nxJson = readJson('nx.json');
    expect(nxJson.tasksRunnerOptions.default.runner).toEqual('@nx-aws-plugin/nx-aws-cache');

    done();
  });
});
