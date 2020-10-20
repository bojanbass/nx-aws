/* eslint-disable import/no-internal-modules */

import { createReadStream, createWriteStream, writeFile } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

import { config as awsConfig, S3 } from 'aws-sdk';
import { PutObjectRequest } from 'aws-sdk/clients/s3';
import { RemoteCache } from '@nrwl/workspace/src/tasks-runner/default-tasks-runner';
import { create, extract } from 'tar';

import { AwsNxCacheOptions } from './models/aws-nx-cache-options.model';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';

export class AwsCache implements RemoteCache {
  private readonly bucket: string;
  private readonly s3: S3;
  private readonly logger = new Logger();
  private uploadQueue: Array<Promise<boolean>> = [];

  public constructor(options: AwsNxCacheOptions, private messages: MessageReporter) {
    this.bucket = options.awsBucket as string;

    if (options.awsRegion) {
      awsConfig.update({ region: options.awsRegion });
    }

    this.s3 = new S3({
      apiVersion: 'latest',
      ...(options.awsSecretAccessKey ? { secretAccessKey: options.awsSecretAccessKey } : {}),
      ...(options.awsAccessKeyId ? { accessKeyId: options.awsAccessKeyId } : {}),
    });
  }

  public static checkConfig(options: AwsNxCacheOptions): void {
    const missingOptions: Array<string> = [],
      externalOptions = new S3().config.credentials;

    if (!options.awsBucket) {
      missingOptions.push('NX_AWS_BUCKET | awsBucket');
    }

    if (!options.awsAccessKeyId && externalOptions === null) {
      missingOptions.push('AWS_ACCESS_KEY_ID | NX_AWS_ACCESS_KEY_ID | awsAccessKeyId');
    }

    if (!options.awsSecretAccessKey && externalOptions === null) {
      missingOptions.push('AWS_SECRET_ACCESS_KEY | NX_AWS_SECRET_ACCESS_KEY | awsSecretAccessKey');
    }

    if (missingOptions.length > 0) {
      throw new Error(`Missing AWS options: \n\n${missingOptions.join('\n')}`);
    }
  }

  public async retrieve(hash: string, cacheDirectory: string): Promise<boolean> {
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
      this.messages.error = err;

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
      this.messages.error = err;

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
    const tgzFileName = this.getTgzFileName(hash),
      params: PutObjectRequest = {
        Bucket: this.bucket,
        Key: tgzFileName,
        Body: createReadStream(tgzFilePath),
      };

    try {
      this.logger.debug(`Storage Cache: Uploading ${hash}`);
      await this.s3.upload(params).promise();
      this.logger.debug(`Storage Cache: Stored ${hash}`);
    } catch (err) {
      throw new Error(`Storage Cache: Upload error - ${err}`);
    }
  }

  private async downloadFile(hash: string, tgzFilePath: string): Promise<void> {
    const pipelinePromise = promisify(pipeline),
      tgzFileName = this.getTgzFileName(hash),
      writeFileToLocalDir = createWriteStream(tgzFilePath),
      readAwsFile = this.s3
        .getObject({
          Bucket: this.bucket,
          Key: tgzFileName,
        })
        .createReadStream();

    try {
      await pipelinePromise(readAwsFile, writeFileToLocalDir);
    } catch (err) {
      throw new Error(`Storage Cache: Download error - ${err}`);
    }
  }

  private async checkIfCacheExists(hash: string): Promise<boolean> {
    const tgzFileName = this.getTgzFileName(hash),
      params = {
        Bucket: this.bucket,
        Key: tgzFileName,
      };

    try {
      await this.s3.headObject(params).promise();

      return true;
    } catch (err) {
      if (err.code === 'NotFound') {
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
