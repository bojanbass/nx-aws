import { config as dotEnvConfig } from 'dotenv';

for (const file of ['.local.env', '.env.local', '.env']) {
  dotEnvConfig({ path: file, quiet: true });
}
