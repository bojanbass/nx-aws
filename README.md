# nx-aws

nx-aws is a set of plugins for [Nx](https://nx.dev) (a set of Extensible Dev Tools for Monorepos).

# @nx-aws-plugin/nx-aws-cache

A tool for using AWS S3 (or any S3 compatible storage, e.g. MinIO) as a distributed computational cache for Nx.

## Which setup do I need?

Nx changed how remote caches are plugged in, so the setup depends on your Nx version:

| Nx version     | Setup                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| 16 – 19        | [Task runner](#task-runner-nx-16--20) (`tasksRunnerOptions` in `nx.json`)                               |
| 20             | [Task runner](#task-runner-nx-16--20) with `"useLegacyCache": true`, or the server (20.8+)              |
| **21 and later** | [Remote cache server](#nx-21-and-later) (`nx-aws-cache-server`), Nx removed support for custom task runners |

> **Do I still need this plugin?** Nx 21 [removed custom task runners](https://nx.dev/blog/custom-runners-and-self-hosted-caching).
> The official `@nx/s3-cache` replacement is deprecated, commercially licensed and does not support Nx 23. The only
> remaining extension point is the [self-hosted remote cache HTTP API](https://nx.dev/recipes/running-tasks/self-hosted-caching),
> which this package implements on top of S3 with `nx-aws-cache-server`. Nx Cloud is the managed alternative.

Install the package by running:

```bash
bun add -D @nx-aws-plugin/nx-aws-cache
yarn add -D @nx-aws-plugin/nx-aws-cache
npm i -D @nx-aws-plugin/nx-aws-cache
```

Requires Node.js 20 or later. Use version 3.2.3 for older Node.js versions.

## Nx 21 and later

`nx-aws-cache-server` is a small HTTP server that implements the
[Nx self-hosted remote cache OpenAPI specification](https://nx.dev/recipes/running-tasks/self-hosted-caching)
and stores the artifacts in S3. Nx talks to it natively (Nx 20.8+), no custom code runs inside Nx.

1. Start the server, configured with the [S3 settings](#s3-settings) and an access token:

   ```bash
   NXCACHE_AWS_BUCKET=bucket-name/sub-path \
   NXCACHE_AWS_REGION=eu-central-1 \
   NXCACHE_SERVER_ACCESS_TOKEN=$(openssl rand -hex 32) \
   npx nx-aws-cache-server
   ```

2. Point Nx at it:

   ```bash
   NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000
   NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<the same token>
   ```

The server can either run next to Nx (e.g. as a background step in a CI job, using the job's AWS credentials), or be
deployed once as a shared service (container, VM, ...). When it is shared, put it behind TLS (e.g. a load balancer or a
reverse proxy), since the access tokens are sent with every request.

> **Security:** use Nx 22.7.2 or later with a self-hosted remote cache, older versions are affected by
> [GHSA-vp3h-ghgh-jr7g](https://github.com/advisories/GHSA-vp3h-ghgh-jr7g).

### Server settings

| Environment variable                     | Description                                                                                             | Default     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- |
| `NXCACHE_SERVER_ACCESS_TOKEN`            | Token with read and write access. At least one of the tokens is required.                               |             |
| `NXCACHE_SERVER_READ_ONLY_ACCESS_TOKEN`  | Token with read-only access, e.g. for developer machines, so only CI can write to the cache.            |             |
| `NXCACHE_SERVER_HOST`                    | Interface to listen on. Use `0.0.0.0` to accept connections from other machines.                        | `127.0.0.1` |
| `NXCACHE_SERVER_PORT` (or `PORT`)        | Port to listen on.                                                                                      | `3000`      |
| `NXCACHE_SERVER_MAX_UPLOAD_BYTES`        | Maximum accepted artifact size.                                                                         | unlimited   |
| `NXCACHE_VERBOSE_LOGGING`                | Set to `true` to log every cache hit, miss and upload.                                                  |             |

The server exposes `GET /health` for load balancer health checks. Artifacts are stored under `<bucket>/<sub-path>/v1/<hash>`
and are immutable, as required by the specification. Use an S3 lifecycle rule to expire old artifacts.

The server can also be started programmatically:

```ts
import { createCacheServer } from '@nx-aws-plugin/nx-aws-cache';

createCacheServer({ awsBucket: 'bucket-name', accessToken: process.env.TOKEN }).listen(3000);
```

## Task runner (Nx 16 – 20)

Run the init generator:

```bash
bun nx generate @nx-aws-plugin/nx-aws-cache:init
yarn nx generate @nx-aws-plugin/nx-aws-cache:init
npm run nx generate @nx-aws-plugin/nx-aws-cache:init
```

This will make the necessary changes to nx.json in your workspace to use the nx-aws-cache runner. On Nx 21 and later the
generator leaves `nx.json` untouched and prints the server setup instead.

> **Nx 20:** the new database cache ignores custom remote caches. The generator sets `"useLegacyCache": true` in
> `nx.json`, otherwise nothing is read from or written to S3 (the runner prints a warning in that case).

### `nx.json` example

```json
{
  "useLegacyCache": true,
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nx-aws-plugin/nx-aws-cache",
      "options": {
        "awsAccessKeyId": "key",
        "awsSecretAccessKey": "secret",
        "awsEndpoint": "http://custom.de-eu.myhost.com",
        "awsBucket": "bucket-name/sub-path",
        "awsRegion": "eu-central-1",
        "awsForcePathStyle": true,
        "encryptionFileKey": "Pbfk58EpcK7IxTxWwSXNsTAKmzhJQE+99vkpGftyJg8="
      }
    }
  }
}
```

### Disabling S3 cache

Remote cache can be disabled in favor of local cache using an environment variable

```bash
NXCACHE_AWS_DISABLE=true
```

## S3 settings

These settings are shared by the task runner and the server. The task runner also reads them from `nx.json`, the server
only from environment variables.

| Parameter         | Description                                                                                         | Environment variable / .env                               | `nx.json`            | Example                                      |
| ----------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------- | -------------------------------------------- |
| Access Key Id     | Access Key Id.                                                                                      | `NXCACHE_AWS_ACCESS_KEY_ID`                               | `awsAccessKeyId`     | my-id                                        |
| Secret Access Key | Secret Access Key.                                                                                  | `NXCACHE_AWS_SECRET_ACCESS_KEY`                           | `awsSecretAccessKey` | my-key                                       |
| Profile           | Configuration profile to use (applied only if Access Key Id and Secret Access Key are not set).     | `NXCACHE_AWS_PROFILE`                                     | `awsProfile`         | profile-1                                    |
| Endpoint          | Fully qualified endpoint of the web service if a custom endpoint is needed (e.g. when using MinIO). | `NXCACHE_AWS_ENDPOINT`                                    | `awsEndpoint`        | http://custom.de-eu.myhost.com               |
| Region            | Region to which this client will send requests.                                                     | `NXCACHE_AWS_REGION`                                      | `awsRegion`          | eu-central-1                                 |
| Bucket            | Bucket name where cache files are stored or retrieved (can contain sub-paths as well).              | `NXCACHE_AWS_BUCKET`                                      | `awsBucket`          | bucket-name/sub-path                         |
| Force Path Style  | Whether to force path style URLs for S3 objects (e.g. when using MinIO).                            | `NXCACHE_AWS_FORCE_PATH_STYLE`                            | `awsForcePathStyle`  | true                                         |
| Encrypt File Key  | Encrypt files before they are sent to S3. 32 bytes in base64.                                       | `NXCACHE_AWS_ENCRYPTION_KEY` or `NX_CLOUD_ENCRYPTION_KEY` | `encryptionFileKey`  | PcZrGOSda3zwWh9yYTJB5bnHORgXf3dphj55tPI74O0= |

> **Important:** `Environment variables` take precedence over `nx.json` options (introduced in v3.0.0)!

> Environment variables can be set using `.env` file - check [dotenv documentation](https://www.npmjs.com/package/dotenv). Files are read in the following order:

- `.local.env`
- `.env.local`
- `.env`

## Encryption

Files can be encrypted before they are sent to S3 (with the server, encryption happens in the server). Set
`NXCACHE_AWS_ENCRYPTION_KEY` or `NX_CLOUD_ENCRYPTION_KEY`.

```sh
# Generate new key for encryption.
openssl rand -base64 32
```

## Authentication

### Default

AWS authentication can be set-up using default environment variables or using shared credentials, based on [AWS documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

### SSO login

To authenticate with SSO via CLI run

`aws sso login`

AWS SDK v3 is used under the hood with a support for [SSO login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).

## Development

### Prerequisites

- [mise](https://mise.jdx.dev/) - manages Node.js and bun versions

```bash
mise install # installs Node.js and bun
bun install
```

### Build

Run `bun nx build nx-aws-cache` to build the plugin. The build artifacts will be stored in the `dist/` directory.

### Running unit tests

Run `bun nx test nx-aws-cache` to execute the unit tests via [Vitest](https://vitest.dev).

Run `bun nx affected -t test` to execute the unit tests affected by a change.

### Updating Nx

Run `bun nx migrate latest`, then `bun install` and `bun nx migrate --run-migrations`.

## Credits

This repository is based on a similar NX plugin using Azure Storage [@nx-azure/storage-cache](https://github.com/microsoft/nx-azure) which was inspired by Nx Cloud Plugin by [Nrwl](https://github.com/nrwl/nx).
