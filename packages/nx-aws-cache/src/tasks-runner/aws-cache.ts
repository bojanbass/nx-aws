import { createReadStream, createWriteStream, writeFile } from 'fs';
import { join } from 'path';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';

import * as clientS3 from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { CredentialsProviderError } from '@aws-sdk/property-provider';
import { RemoteCache } from '@nrwl/workspace/src/tasks-runner/default-tasks-runner';
import { create, extract } from 'tar';

import { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';

export class AwsCache implements RemoteCache {
  private readonly bucket: string;
  private readonly s3: clientS3.S3Client;
  private readonly logger = new Logger();
  private uploadQueue: Array<Promise<boolean>> = [];

  public constructor(options: AwsNxCacheOptions, private messages: MessageReporter) {
    this.bucket = options.awsBucket as string;

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

    this.s3 = new clientS3.S3Client(clientConfig);
  }

  public checkConfig(options: AwsNxCacheOptions): void {
    const missingOptions: Array<string> = [];

    if (!options.awsBucket) {
      missingOptions.push('NX_AWS_BUCKET | awsBucket');
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
      await this.uploadFile(hash, tgzFilePath);

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
      });
    } catch (err) {
      throw new Error(`Error extracting tar.gz file - ${err}`);
    }
  }

  private async uploadFile(hash: string, tgzFilePath: string): Promise<void> {
    const tgzFileName = this.getTgzFileName(hash);
    const params: clientS3.PutObjectCommand = new clientS3.PutObjectCommand({
      Bucket: this.bucket,
      Key: tgzFileName,
      Body: createReadStream(tgzFilePath),
      ServerSideEncryption: 'aws:kms'
    });

    try {
      this.logger.debug(`Storage Cache: Uploading ${hash}`);

      await this.s3.send(params);

      this.logger.debug(`Storage Cache: Stored ${hash}`);
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
        Key: tgzFileName,
      });

    try {
      const commandOutput = await this.s3.send(params);
      const fileStream = commandOutput.Body as Readable;

      await pipelinePromise(fileStream, writeFileToLocalDir);
    } catch (err) {
      throw new Error(`Storage Cache: Download error - ${err}`);
    }
  }

  private async checkIfCacheExists(hash: string): Promise<boolean> {
    const tgzFileName = this.getTgzFileName(hash),
      params: clientS3.HeadObjectCommand = new clientS3.HeadObjectCommand({
        Bucket: this.bucket,
        Key: tgzFileName,
      });

    try {
      await this.s3.send(params);

      return true;
    } catch (err) {
      if ((err as Error).name === 'NotFound') {
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
}
