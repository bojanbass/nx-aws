# nx-aws

nx-aws is a set of plugins for NRWL NX (a set of Extensible Dev Tools for Monorepos).

# @nx-aws-plugin/nx-aws-cache

A tool for using AWS S3 as a distributed computational cache for Nx.

## Setup

Install the package by running:

```bash
yarn add @nx-aws-plugin/nx-aws-cache
npm i @nx-aws-plugin/nx-aws-cache
```

Then run the init schematic by running:

```bash
yarn nx generate @nx-aws-plugin/nx-aws-cache:init
npm run nx generate @nx-aws-plugin/nx-aws-cache:init
```

This will make the necessary changes to nx.json in your workspace to use nx-aws-cache runner.

## Plugin settings

There are two ways to set-up plugin options, using `nx.json` or `Environment variables`. Here is a list of all possible options:

| Parameter         | Description                                                                                         | Environment variable / .env                               | `nx.json`            | Example                                      |
| ----------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------- | -------------------------------------------- |
| Access Key Id     | Access Key Id.                                                                                      | `NXCACHE_AWS_ACCESS_KEY_ID`                               | `awsAccessKeyId`     | my-id                                        |
| Secret Access Key | Secret Access Key.                                                                                  | `NXCACHE_AWS_SECRET_ACCESS_KEY`                           | `awsSecretAccessKey` | my-key                                       |
| Profile           | Configuration profile to use (applied only if Access Key Id and Secret Access Key are not set).     | `NXCACHE_AWS_PROFILE`                                     | `awsProfile`         | profile-1                                    |
| Endpoint          | Fully qualified endpoint of the web service if a custom endpoint is needed (e.g. when using MinIO). | `NXCACHE_AWS_ENDPOINT`                                    | `awsEndpoint`        | http://custom.de-eu.myhost.com               |
| Region            | Region to which this client will send requests.                                                     | `NXCACHE_AWS_REGION`                                      | `awsRegion`          | eu-central-1                                 |
| Bucket            | Bucket name where cache files are stored or retrieved (can contain sub-paths as well).              | `NXCACHE_AWS_BUCKET`                                      | `awsBucket`          | bucket-name/sub-path                         |
| Force Path Style  | Whether to force path style URLs for S3 objects (e.g. when using MinIO).                            | `NXCACHE_AWS_FORCE_PATH_STYLE`                            | `awsForcePathStyle`  | true                                         |
| Enrypt File Key   | Encrypt file in client before send to S3 server. 32 bytes in base64                                 | `NXCACHE_AWS_ENCRYPTION_KEY` or `NX_CLOUD_ENCRYPTION_KEY` | `encryptionFileKey`  | PcZrGOSda3zwWh9yYTJB5bnHORgXf3dphj55tPI74O0= |

> **Important:** `Environment variables` take precedence over `nx.json` options (introduced in v3.0.0)!

### `nx.json` example

```json
{
  "tasksRunnerOptions": {
  "default": {
    "runner": "@nx-aws-plugin/nx-aws-cache",
    "options": {
      ...
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
```

> Environment variables can be set using `.env` file - check [dotenv documentation](https://www.npmjs.com/package/dotenv). Files are read in the following order:

- `.local.env`
- `.env.local`
- `.env`

## Encryption

If you want you can encrypt file before send to s3 server (Client side). Use ENV
NX_CLOUD_ENCRYPTION_KEY or NXCACHE_CLOUD_ENCRYPTION_KEY

```sh
# Generate new key for encryption.
openssl rand -base64 32
```

## Disabling S3 cache

Remote cache can be disabled in favor of local cache using an environment variable

```bash
NXCACHE_AWS_DISABLE=true
```

## Authentication

### Default

AWS authentication can be set-up using default environment variables or using shared credentials, based on [AWS documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

### SSO login

To authenticate with SSO via CLI run

`aws sso login`

AWS SDK v3 is used under the hood with a support for [SSO login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).

## Build

Run `yarn nx build nx-aws-cache` to build the plugin. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `yarn nx test nx-aws-cache` to execute the unit tests via [Jest](https://jestjs.io).

Run `yarn nx affected:test` to execute the unit tests affected by a change.

## Running end-to-end tests

Run `yarn nx e2e nx-aws-cache-e2e` to execute the end-to-end tests via [Jest](https://jestjs.io).

Run `yarn nx affected:e2e` to execute the end-to-end tests affected by a change.

## Credits

This repository is based on a similar NX plugin using Azure Storage [@nx-azure/storage-cache](https://github.com/microsoft/nx-azure) which was inspired by Nx Cloud Plugin by [Nrwl](https://github.com/nrwl/nx).
