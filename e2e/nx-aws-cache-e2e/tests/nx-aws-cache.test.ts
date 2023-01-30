import { ensureDirSync } from 'fs-extra';
import {
  cleanup,
  patchPackageJsonForPlugin,
  readJson,
  runCommandAsync,
  tmpProjPath,
} from '@nrwl/nx-plugin/testing';
import { execSync } from 'child_process';
import { dirname } from 'node:path';
import { getPackageManagerCommand } from '@nrwl/devkit';

function runNxNewCommand() {
  const localTmpDir = dirname(tmpProjPath());

  return execSync(
    `npx nx new proj --nx-workspace-root=${localTmpDir} --no-interactive --skip-install --collection=@nrwl/workspace --npmScope=proj --preset=empty`,
    {
      cwd: localTmpDir,
    },
  );
}

function runPackageManagerInstall(silent: boolean = true) {
  const pmc = getPackageManagerCommand('npm');
  const install = execSync(pmc.install, {
    cwd: tmpProjPath(),
    ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {}),
  });

  return install ? install.toString() : '';
}

describe('aws-cache e2e', () => {
  beforeAll(() => {
    ensureDirSync(tmpProjPath());
    cleanup();
    runNxNewCommand();
    patchPackageJsonForPlugin('@nx-aws-plugin/nx-aws-cache', 'dist/packages/nx-aws-cache');
    runPackageManagerInstall();
  });

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runCommandAsync('npx nx reset');
  });

  it('should init nx-aws-cache', async () => {
    await runCommandAsync(
      `npx nx generate @nx-aws-plugin/nx-aws-cache:init --awsRegion=eu-central-1 --awsBucket=bucket-name/cache-folder`,
    );

    const nxJson = readJson('nx.json');
    expect(nxJson.tasksRunnerOptions.default.runner).toEqual('@nx-aws-plugin/nx-aws-cache');
  }, 120000);
});
