#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

const main = async () => {
  const [, , command] = process.argv;

  if (command !== 'deploy' && command !== 'destroy' && command !== 'diff') {
    console.error('Command must be one of `deploy`, `destroy`, or `diff`');
    return;
  }

  const appPath = path.resolve(__dirname, 'cdk-app.cjs');

  const spawnedProcess = spawn('npx', ['cdk@2', command, '--all', '--app', `node ${appPath}`], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  const promise = new Promise<void>((resolve, reject) => {
    spawnedProcess.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`Process exited with code ${code}`)),
    );
  });

  await promise;

  if (command === 'deploy')
    console.info(
      'Deployment complete. You can now run `npx @nx-aws-plugin/nx-aws-cache-iac config-to-env` to configure your Nx AWS Cache.',
    );
};

main();
