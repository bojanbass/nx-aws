# nx-aws

nx-aws is a set of plugins for NRWL NX (a set of Extensible Dev Tools for Monorepos).

# @nx-aws/nx-aws-cache

A tool for using AWS S3 as a distributed computational cache for Nx.

## Setup

Install the package by running:

```bash
yarn add @nx-aws/nx-aws-cache
npm i @nx-aws/nx-aws-cache
```

Then run the init schematic by running:

```bash
yarn nx generate @nx-aws/nx-aws-cache:init
npm run nx generate @nx-aws/nx-aws-cache:init
```

This will make the necessary changes to nx.json in your workspace to use nx-aws-cache runner.

## AWS settings

There are two ways to set-up AWS options:

### Using nx.json file (NOT recommended)

```json
{
  "tasksRunnerOptions": {
  "default": {
    "runner": "@nx-aws/nx-aws-cache",
    "options": {
      ...
      "awsAccessKeyId": "[secret]",
      "awsSecretAccessKey": "[secret]",
      "awsRegion": "eu-central-1",
      "awsBucket": "bucket-name/cache-folder"
    } 
  }
}
```

### Using environment variables (**recommended**)

```bash
NX_AWS_ACCESS_KEY_ID=[secret]
NX_AWS_SECRET_ACCESS_KEY=[secret]
NX_AWS_REGION=eu-central-1
NX_AWS_BUCKET=bucket-name/cache-folder
```

Additionally, AWS authentication can be set-up using default environment variables or using shared credentials, based on [AWS documentation](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html)

### Using environment variables
```bash
AWS_ACCESS_KEY_ID=[secret]
AWS_SECRET_ACCESS_KEY=[secret]
```

### Using shared credentials file (`~/.aws/credentials`)

```
[default]
aws_access_key_id = [secret]
aws_secret_access_key = [secret]
```

> Environment variables can be set using `.env` file - check [dotenv documentation](https://www.npmjs.com/package/dotenv).

## Build

Run `yarn nx build nx-aws-cache` to build the plugin. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `yarn nx test nx-aws-cache` to execute the unit tests via [Jest](https://jestjs.io).

Run `yarn nx affected:test` to execute the unit tests affected by a change.

## Running end-to-end tests

Run `yarn nx e2e nx-aws-cache` to execute the end-to-end tests via [Cypress](https://www.cypress.io).

Run `yarn nx affected:e2e` to execute the end-to-end tests affected by a change.
