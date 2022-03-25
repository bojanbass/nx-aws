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

## AWS settings

There are two ways to set-up AWS options:

### Using nx.json

```json
{
  "tasksRunnerOptions": {
  "default": {
    "runner": "@nx-aws-plugin/nx-aws-cache",
    "options": {
      ...
      "awsRegion": "eu-central-1",
      "awsBucket": "bucket-name",
      "awsProfile": "profile-1",
      "awsEndpoint": "custom.de-eu.myhost.com",
    }
  }
}
```

### Using environment variables

```bash
NX_AWS_REGION=eu-central-1
NX_AWS_BUCKET=bucket-name
NX_AWS_PROFILE=profile-1
NX_AWS_ENDPOINT=[URL] # default s3.[region].amazonaws.com
```
> Environment variables can be set using `.env` file - check [dotenv documentation](https://www.npmjs.com/package/dotenv).

## Disabling S3 cache

Remote cache can be disabled in favor of local cache only using an environment variable
```bash
NX_AWS_DISABLE=true
```

## Authentication

### Default

AWS authentication can be set-up using default environment variables or using shared credentials, based on [AWS documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html). 

### SSO login

To authenticate with SSO via CLI run

`aws sso login`

AWS SDK v3 is used under the hood with a support for [SSO login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).

### Custom environment variables

Custom environment variables can be set for an alternate way of authentication
```bash
NX_AWS_ACCESS_KEY_ID=[secret]
NX_AWS_SECRET_ACCESS_KEY=[secret]
```

## Build

Run `yarn nx build nx-aws-cache` to build the plugin. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `yarn nx test nx-aws-cache` to execute the unit tests via [Jest](https://jestjs.io).

Run `yarn nx affected:test` to execute the unit tests affected by a change.

## Running end-to-end tests

Run `yarn nx e2e nx-aws-cache` to execute the end-to-end tests via [Cypress](https://www.cypress.io).

Run `yarn nx affected:e2e` to execute the end-to-end tests affected by a change.

## Credits

This repository is based on a similar NX plugin using Azure Storage [@nx-azure/storage-cache](https://github.com/microsoft/nx-azure) which was inspired by Nx Cloud Plugin by [Nrwl](https://github.com/nrwl/nx). 