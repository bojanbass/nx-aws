#!/usr/bin/env node

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { exit } from 'node:process';

const getAWSSecretConfiguration = async (value: string) => {
  const secretsmanager = new SecretsManagerClient({});

  const getSecretCmd = new GetSecretValueCommand({
    SecretId: value,
  });

  const secretString = (await secretsmanager.send(getSecretCmd)).SecretString!;

  return JSON.parse(secretString) as Record<string, string>;
};

export const createEnvFileFromPairs = (
  environmentPairs: Record<string, string>,
  directory: string,
  fileName: string,
) => {
  const dotenvPath = resolve(directory, fileName);
  console.log(` 📚 Exporting vars into ${dotenvPath}`);

  const encoding = 'utf8';

  let currentData: { [value: string]: string } = {};

  try {
    if (existsSync(dotenvPath)) currentData = parse(readFileSync(dotenvPath, { encoding }));
  } catch (error: unknown) {
    throw new Error(`Failed to read ${dotenvPath}`);
  }

  // NOTE: we don't override existing values
  const combined = { ...currentData, ...environmentPairs };

  let fileData = Object.entries(combined)
    .map(([key, value]) => {
      try {
        JSON.parse(value);

        return `${key}='${value}'`;
      } catch (error) {
        return `${key}=${JSON.stringify(value)}`;
      }
    })
    .join('\n');

  fileData += '\n';

  const newEntries = Math.abs(Object.entries(currentData).length - Object.entries(combined).length);

  console.log(newEntries > 0 ? ` ✅ Added ${newEntries} new entries` : ' ✅ No new entries');

  writeFileSync(dotenvPath, fileData, { encoding });
};

async function main() {
  try {
    const secretName = '/nx-aws-cache/configuration';
    const secrets = await getAWSSecretConfiguration(secretName);

    createEnvFileFromPairs(secrets, process.cwd(), '.env.local');
  } catch (err) {
    console.error('Failed:', err);
    exit(1);
  }
}

main();
