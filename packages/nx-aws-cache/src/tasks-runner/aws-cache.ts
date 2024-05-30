import { createReadStream, createWriteStream, writeFile } from 'fs';
import { join, dirname } from 'path';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';
import * as clientS3 from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { CredentialsProviderError } from '@aws-sdk/property-provider';
import { RemoteCache } from '@nx/workspace/src/tasks-runner/default-tasks-runner';
import { create, extract } from 'tar';
import { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';
import { Encrypt, Decrypt, EncryptConfig } from './encryptor';
import { Upload } from '@aws-sdk/lib-storage';

export class AwsCache implements RemoteCache {
  private readonly bucket: string;
  private readonly path: string;
  private readonly s3: clientS3.S3Client;
  private readonly logger = new Logger();
  private readonly uploadQueue: Array<Promise<boolean>> = [];
  private readonly encryptConfig: EncryptConfig | undefined;

  public constructor(options: AwsNxCacheOptions, private messages: MessageReporter) {
    const awsBucket = options.awsBucket ?? '';
    const bucketTokens = awsBucket.split('/');
    this.bucket = bucketTokens.shift() as string;
    this.path = bucketTokens.join('/');

    const clientConfig: clientS3.S3ClientConfig = {};

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

    if (options?.encryptionFileKey) {
      this.encryptConfig = new EncryptConfig(options.encryptionFileKey);
    }

    this.s3 = new clientS3.S3Client(clientConfig);
  }

  public checkConfig(options: AwsNxCacheOptions): void {
    const missingOptions: Array<string> = [];

    if (!options.awsBucket) {
      missingOptions.push('NXCACHE_AWS_BUCKET | awsBucket');
    }

    if (missingOptions.length > 0) {
      throw new Error(`Missing AWS options: \n\n${missingOptions.join('\n')}`);
    }
  }

  // eslint-disable-next-line max-statements
  public async retrieve(hash: string, cacheDirectory: string): Promise<boolean> {
    try {
      await this.s3.config.credentials();
    } catch (err) {
      this.messages.error = err as Error;
      return false;
    }
    if (this.messages.error) {
      return false;
    }

    try {
      this.logger.debug(`Storage Cache: Downloading ${hash}`);

      const tgzFilePath: string = this.getTgzFilePath(hash, cacheDirectory);

      if (!(await this.checkIfCacheExists(hash))) {
        this.logger.debug(`Storage Cache: Cache miss ${hash}`);

        return false;
      }

      await this.downloadFile(hash, tgzFilePath);
      await this.extractTgzFile(tgzFilePath, cacheDirectory);
      await this.createCommitFile(hash, cacheDirectory);

      this.logger.debug(`Storage Cache: Cache hit ${hash}`);

      return true;
    } catch (err) {
      this.messages.error = err as Error;

      this.logger.debug(`Storage Cache: Cache error ${hash}`);

      return false;
    }
  }

  public store(hash: string, cacheDirectory: string): Promise<boolean> {
    if (this.messages.error) {
      return Promise.resolve(false);
    }

    const resultPromise = this.createAndUploadFile(hash, cacheDirectory);
    this.uploadQueue.push(resultPromise);

    return resultPromise;
  }

  public async waitForStoreRequestsToComplete(): Promise<void> {
    await Promise.all(this.uploadQueue);
  }

  private async createAndUploadFile(hash: string, cacheDirectory: string): Promise<boolean> {
    try {
      const tgzFilePath = this.getTgzFilePath(hash, cacheDirectory);
      await this.createTgzFile(tgzFilePath, hash, cacheDirectory);
      const sourceFileStream = createReadStream(tgzFilePath);

      await this.uploadFile(
        hash,
        this.encryptConfig
          ? sourceFileStream.pipe(new Encrypt(this.encryptConfig))
          : sourceFileStream,
      );

      return true;
    } catch (err) {
      this.messages.error = err as Error;

      return false;
    }
  }

  private async createTgzFile(
    tgzFilePath: string,
    hash: string,
    cacheDirectory: string,
  ): Promise<void> {
    try {
      await create(
        {
          gzip: true,
          file: tgzFilePath,
          cwd: cacheDirectory,
          filter: (path: string) => this.filterTgzContent(path),
        },
        [hash],
      );
    } catch (err) {
      throw new Error(`Error creating tar.gz file - ${err}`);
    }
  }

  private async extractTgzFile(tgzFilePath: string, cacheDirectory: string): Promise<void> {
    try {
      await extract({
        file: tgzFilePath,
        cwd: cacheDirectory,
        filter: (path: string) => this.filterTgzContent(path),
      });
    } catch (err) {
      throw new Error(`Error extracting tar.gz file - ${err}`);
    }
  }

  private getS3Key(tgzFileName: string) {
    return join(this.path, tgzFileName);
  }

  /**
   * When uploading a file with a transform stream, the final ContentLength is unknown so it has to be uploaded as multipart.
   *
   * @param hash
   * @param file
   * @private
   */
  private async uploadFile(hash: string, file: Readable) {
    try {
      this.logger.debug(`Storage Cache: Uploading ${hash}`);

      const tgzFileName = this.getTgzFileName(hash);

      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: this.getS3Key(tgzFileName),
          Body: file,
        },
      });

      const response = await upload.done();
      this.logger.debug(`Storage Cache: Stored ${hash}`);

      return response;
    } catch (err) {
      throw new Error(`Storage Cache: Upload error - ${err}`);
    }
  }

  private async downloadFile(hash: string, tgzFilePath: string): Promise<void> {
    const pipelinePromise = promisify(pipeline),
      tgzFileName = this.getTgzFileName(hash),
      writeFileToLocalDir = createWriteStream(tgzFilePath),
      params = new clientS3.GetObjectCommand({
        Bucket: this.bucket,
        Key: this.getS3Key(tgzFileName),
      });

    try {
      const commandOutput = await this.s3.send(params);
      const fileStream = commandOutput.Body as Readable;
      if (this.encryptConfig) {
        await pipelinePromise(fileStream, new Decrypt(this.encryptConfig), writeFileToLocalDir);
      } else {
        await pipelinePromise(fileStream, writeFileToLocalDir);
      }
    } catch (err) {
      throw new Error(`Storage Cache: Download error - ${err}`);
    }
  }

  private async checkIfCacheExists(hash: string): Promise<boolean> {
    const tgzFileName = this.getTgzFileName(hash),
      params: clientS3.HeadObjectCommand = new clientS3.HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.getS3Key(tgzFileName),
      });

    try {
      await this.s3.send(params);
      return true;
    } catch (err) {
      if ((err as Error).name === '403' || (err as Error).name === 'NotFound') {
        return false;
      } else if (err instanceof CredentialsProviderError) {
        return false;
      }

      throw new Error(`Error checking cache file existence - ${err}`);
    }
  }

  private async createCommitFile(hash: string, cacheDirectory: string): Promise<void> {
    const writeFileAsync = promisify(writeFile);

    await writeFileAsync(join(cacheDirectory, this.getCommitFileName(hash)), 'true');
  }

  private getTgzFileName(hash: string): string {
    return `${hash}.tar.gz`;
  }

  private getTgzFilePath(hash: string, cacheDirectory: string): string {
    return join(cacheDirectory, this.getTgzFileName(hash));
  }

  private getCommitFileName(hash: string): string {
    return `${hash}.commit`;
  }

  private filterTgzContent(filePath: string): boolean {
    const dir = dirname(filePath);
    const excludedPaths = [
      /**
       * The 'source' file is used by NX for integrity check purposes, but isn't utilized by custom cache providers.
       * Excluding it from the tarball saves space and avoids potential NX cache integrity issues.
       * See: https://github.com/bojanbass/nx-aws/issues/368 and https://github.com/nrwl/nx/issues/19159 for more context.
       */
      join(dir, 'source'),
    ];

    return !excludedPaths.includes(filePath);
  }
}
