import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { AwsNxCacheOptions } from './tasks-runner/models/aws-nx-cache-options.model';

/**
 * Resolves AWS options, environment variables take precedence over the provided options.
 */
export function resolveAwsOptions(options: AwsNxCacheOptions = {}): AwsNxCacheOptions {
  return {
    awsAccessKeyId: process.env.NXCACHE_AWS_ACCESS_KEY_ID ?? options.awsAccessKeyId,
    awsSecretAccessKey: process.env.NXCACHE_AWS_SECRET_ACCESS_KEY ?? options.awsSecretAccessKey,
    awsProfile: process.env.NXCACHE_AWS_PROFILE ?? options.awsProfile,
    awsEndpoint: process.env.NXCACHE_AWS_ENDPOINT ?? options.awsEndpoint,
    awsRegion: process.env.NXCACHE_AWS_REGION ?? options.awsRegion,
    awsBucket: process.env.NXCACHE_AWS_BUCKET ?? options.awsBucket,
    awsForcePathStyle: process.env.NXCACHE_AWS_FORCE_PATH_STYLE
      ? process.env.NXCACHE_AWS_FORCE_PATH_STYLE === 'true'
      : options.awsForcePathStyle,
    encryptionFileKey:
      process.env.NX_CLOUD_ENCRYPTION_KEY ??
      process.env.NXCACHE_AWS_ENCRYPTION_KEY ??
      options.encryptionFileKey,
  };
}

/**
 * Splits `bucket-name/sub/path` into the bucket name and the key prefix.
 */
export function splitBucket(awsBucket = ''): { bucket: string; path: string } {
  const [bucket, ...path] = awsBucket.split('/');

  return { bucket, path: path.join('/') };
}

export function createS3Client(options: AwsNxCacheOptions): S3Client {
  const clientConfig: S3ClientConfig = {};

  if (options.awsRegion) {
    clientConfig.region = options.awsRegion;
  }

  if (options.awsEndpoint) {
    clientConfig.endpoint = options.awsEndpoint;
  }

  if (options.awsAccessKeyId && options.awsSecretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: options.awsAccessKeyId,
      secretAccessKey: options.awsSecretAccessKey,
    };
  } else {
    clientConfig.credentials = fromNodeProviderChain(
      options.awsProfile ? { profile: options.awsProfile } : {},
    );
  }

  if (options.awsForcePathStyle) {
    clientConfig.forcePathStyle = true;
  }

  return new S3Client(clientConfig);
}
