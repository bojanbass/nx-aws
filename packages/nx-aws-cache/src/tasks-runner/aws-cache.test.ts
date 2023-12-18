import * as fs from 'fs';
import * as os from 'os';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';

describe('Test aws put and get unencrypted file', () => {
  let awsCache: AwsCache;
  let uploadedData: Buffer | null;
  const hash = randomUUID();
  const cacheDirectory = path.join(os.tmpdir(), 'aws-cache');
  const cacheDirectorySave = path.join(os.tmpdir(), 'aws-cache-decompress');
  const fileContent = 'console.log(123)';
  let filePath = '';

  const config = {
    encryptionFileKey: 'Pbfk58EpcK7IxTxWwSXNsTAKmzhJQE+99vkpGftyJg8=',
    awsAccessKeyId: 'minio',
    awsSecretAccessKey: 'minio123',
    awsBucket: 'test',
    awsEndpoint: 'http://127.0.0.1:9000',
    awsForcePathStyle: true,
    awsRegion: 'us-east-1',
  };

  beforeEach(() => {
    uploadedData = null;
    awsCache = new AwsCache(config, new MessageReporter(new Logger()));
    const s3Mock = mockClient(S3Client);
    s3Mock.on(GetObjectCommand).callsFake(() => {
      if (!uploadedData) {
        throw new Error('No upload data');
      }
      return {
        Body: Readable.from(uploadedData),
      };
    });

    // Aws-sdk-client-mock not mock CreateMultipartUploadCommand and UploadPartCommand for @aws-sdk/lib-storage I dont know why. There is a issue with this: https://github.com/m-radzikowski/aws-sdk-client-mock/issues/118
    s3Mock.onAnyCommand((input: { Body?: Buffer }) => {
      if (input?.Body) {
        uploadedData = input.Body;
        return { ETag: '1' };
      }
      /* eslint consistent-return: "warn", no-useless-return: "warn" */
      return;
    });

    fs.mkdirSync(cacheDirectory, {
      recursive: true,
    });
    fs.mkdirSync(cacheDirectorySave, {
      recursive: true,
    });
    const fileDir = path.join(cacheDirectory, `${hash}/outputs`);
    fs.mkdirSync(fileDir, { recursive: true });
    filePath = path.join(fileDir, 'test.js');
    fs.writeFileSync(filePath, fileContent);
  });

  it('Should be defined', () => {
    expect(awsCache).toBeDefined();
  });

  it('Should save encrypted data in s3 file, and read an unencrypted', async () => {
    await awsCache.store(hash, cacheDirectory);
    await awsCache.retrieve(hash, cacheDirectorySave);
    const extractedFilePath = path.join(cacheDirectorySave, `${hash}/outputs/test.js`);
    expect(fs.existsSync(extractedFilePath)).toBeTruthy();
    expect(fs.readFileSync(extractedFilePath).toString()).toBe(fileContent);
  });

  it('Should save in unencrypted s3 file, and read an unencrypted', async () => {
    const configWithoutEncryption = {
      ...config,
      encryptionFileKey: '',
    };
    awsCache = new AwsCache(configWithoutEncryption, new MessageReporter(new Logger()));

    await awsCache.store(hash, cacheDirectory);
    await awsCache.retrieve(hash, cacheDirectorySave);
    const extractedFilePath = path.join(cacheDirectorySave, `${hash}/outputs/test.js`);
    expect(fs.existsSync(extractedFilePath)).toBeTruthy();
    expect(fs.readFileSync(extractedFilePath).toString()).toBe(fileContent);
  });
});
