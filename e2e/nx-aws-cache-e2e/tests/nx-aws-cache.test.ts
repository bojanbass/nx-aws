import {
  ensureNxProject,
  readJson,
  runNxCommandAsync
} from '@nrwl/nx-plugin/testing';
describe('nx-aws-cache e2e', () => {
  it('should create nx-aws-cache', async (done) => {
    ensureNxProject('@nx-aws/nx-aws-cache', 'dist/packages/nx-aws-cache');
    await runNxCommandAsync(
      `generate @nx-aws/nx-aws-cache:init --awsAccessKeyId=test --awsSecretAccessKey=test --awsRegion=eu-central-1 --awsBucket=bucket-name/cache-folder`
    );

    const nxJson = readJson("nx.json");
    expect(nxJson.tasksRunnerOptions.default.runner).toEqual(
      "@nx-aws/nx-aws-cache"
    );

    done();
  });
});
