## Unreleased (4.0.0)

### ⚠️ Breaking Changes

- Requires Node.js 20 or later (required by the AWS SDK).
- `@nx/workspace` is no longer a peer dependency. `nx` and `@nx/devkit` are optional peers, only needed by the task runner.

### 🚀 Features

- `nx-aws-cache-server`: S3 backed implementation of the Nx self-hosted remote cache API for Nx 20.8+ (including Nx 21, 22 and 23, which no longer support custom task runners). Supports read-write and read-only tokens and encryption at rest.
- `init` generator detects the Nx version: it prints the server setup on Nx 21+ and enables `useLegacyCache` on Nx 20.
- The task runner warns when Nx 20 ignores the remote cache because the legacy cache is disabled.

### 🩹 Fixes

- The published package declares its runtime dependencies again (3.4.x prereleases were published without them).
- dotenv no longer prints a log line on every Nx command.
- Upgraded dependencies (AWS SDK, tar, dotenv) and resolved all known advisories.

## 3.4.4-0 (2026-04-01)

### 🩹 Fixes

- bun.lock ([c71df2e](https://github.com/bojanbass/nx-aws/commit/c71df2e))

### ❤️ Thank You

- Bojan Bratuz

## 3.4.3-0 (2026-04-01)

### 🩹 Fixes

- bun.lock ([c71df2e](https://github.com/bojanbass/nx-aws/commit/c71df2e))

### ❤️ Thank You

- Bojan Bratuz

## 3.4.2-0 (2026-04-01)

### 🩹 Fixes

- bun.lock ([c71df2e](https://github.com/bojanbass/nx-aws/commit/c71df2e))

### ❤️ Thank You

- Bojan Bratuz

## 3.4.1-0 (2026-04-01)

### 🩹 Fixes

- bun.lock ([c71df2e](https://github.com/bojanbass/nx-aws/commit/c71df2e))

### ❤️ Thank You

- Bojan Bratuz

## 3.4.0-0 (2026-04-01)

### 🩹 Fixes

- bun.lock ([c71df2e](https://github.com/bojanbass/nx-aws/commit/c71df2e))

### ❤️ Thank You

- Bojan Bratuz

## 3.3.0-alpha.4 (2026-04-01)

### 🚀 Features

- added the possibility to override nx.json configurations with env vars ([1551e27](https://github.com/bojanbass/nx-aws/commit/1551e27))
- **dotEnv:** add support for .local.env files ([dea8059](https://github.com/bojanbass/nx-aws/commit/dea8059))
- **nx-aws-cache:** foreign machine cache support ([9f73af4](https://github.com/bojanbass/nx-aws/commit/9f73af4))
- **nx-aws-cache:** foreign machine cache - support property in generator ([5c42fd8](https://github.com/bojanbass/nx-aws/commit/5c42fd8))

### 🩹 Fixes

- support promise or observable from runner ([8986df8](https://github.com/bojanbass/nx-aws/commit/8986df8))
- bun.lock ([c71df2e](https://github.com/bojanbass/nx-aws/commit/c71df2e))

### ❤️ Thank You

- Andrea Mannini @manniniandrea
- Bojan Bratuz
- Darren Divecha @null
- Jay Bell
- Sebastian Sędzik