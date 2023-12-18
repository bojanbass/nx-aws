import * as fs from 'fs';
import * as os from 'os';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { Readable } from 'stream';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { MessageReporter } from './message-reporter';
import { Encrypt, EncryptConfig } from './encryptor';

// eslint-disable-next-line max-lines-per-function
describe('Test aws put and get unencrypted file', () => {
  let uploadedData: Buffer | null;
  let awsCache: AwsCache;
  const s3Mock = mockClient(S3Client);
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
    s3Mock.on(GetObjectCommand).callsFake(() => {
      if (!uploadedData) {
        throw new Error('No upload data');
      }
      return {
        Body: Readable.from(uploadedData),
      };
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

  afterEach(() => {
    jest.resetAllMocks();
    s3Mock.reset();
  });

  it('Should save encrypted data in s3 file, and read an unencrypted', async () => {
    awsCache = new AwsCache(config, new MessageReporter(new Logger()));

    await awsCache.store(hash, cacheDirectory);

    const tgzFilePath = path.join(cacheDirectory, `${hash}.tar.gz`);
    const tgzFileStream = fs.createReadStream(tgzFilePath);
    const sdkStream = sdkStreamMixin(
      tgzFileStream.pipe(new Encrypt(new EncryptConfig(config.encryptionFileKey))),
    );
    s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream });

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

    const tgzFilePath = path.join(cacheDirectory, `${hash}.tar.gz`);
    const tgzFileStream = fs.createReadStream(tgzFilePath);
    const sdkStream = sdkStreamMixin(tgzFileStream);

    s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream });

    await awsCache.retrieve(hash, cacheDirectorySave);
    const extractedFilePath = path.join(cacheDirectorySave, `${hash}/outputs/test.js`);
    expect(fs.existsSync(extractedFilePath)).toBeTruthy();
    expect(fs.readFileSync(extractedFilePath).toString()).toBe(fileContent);
  });
});
