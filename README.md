# @kor/nx-aws-cache

A tool for using AWS S3 as a distributed computational cache for Nx.
Forked from the original: https://www.npmjs.com/package/@nx-aws-plugin/nx-aws-cache

## Difference with original package:

The original package uses AWS SDK. 
This fork uses AWS CLI to make use of SSO login.

## Setup

Install the package by running:

```bash
yarn add @kor/nx-aws-cache
npm i @kor/nx-aws-cache
```

Then run the init schematic by running:

```bash
yarn nx generate @kor/nx-aws-cache:init
npm run nx generate @kor/nx-aws-cache:init
```

This will make the necessary changes to nx.json in your workspace to use nx-aws-cache runner.

## AWS settings

There are two ways to set-up AWS options:

### Using nx.json file (NOT recommended)

```json
{
  "tasksRunnerOptions": {
  "default": {
    "runner": "@kor/nx-aws-cache",
    "options": {
      ...
      "awsRegion": "eu-central-1",
      "awsBucket": "bucket-name/cache-folder"
    }
  }
}
```

### Using environment variables (**recommended**)

```bash
NX_AWS_REGION=eu-central-1
NX_AWS_BUCKET=bucket-name/cache-folder
```

### Using SSO

You need to authenticate with SSO via CLI

```aws sso login```

Not being authenticated will not fail your task executions, but you will be limited to your own local cache.

## Build

Run `npx nx build nx-aws-cache` to build the plugin. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `npx nx test nx-aws-cache` to execute the unit tests via [Jest](https://jestjs.io).

Run `npx nx affected:test` to execute the unit tests affected by a change.

## Running end-to-end tests

Run `npx nx e2e nx-aws-cache` to execute the end-to-end tests via [Cypress](https://www.cypress.io).

Run `npx nx affected:e2e` to execute the end-to-end tests affected by a change.

## Credits

This repository is based on a similar NX plugin using Azure Storage [@nx-azure/storage-cache](https://github.com/microsoft/nx-azure) which was inspired by Nx Cloud Plugin by [Nrwl](https://github.com/nrwl/nx). 
