import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createWriteStream } from 'fs';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';
import { AwsCache } from './aws-cache';
import { Logger } from './logger';
import { Decrypt, EncryptConfig } from './encryptor';
import { MessageReporter } from './message-reporter';

describe('Test aws put and get unencrypted file', () => {
  let awsCache: AwsCache;
  let hash = new Date().getTime().toString();
  let cacheDirectory = path.join(os.tmpdir(), `aws-cache`);
  let cacheDirectorySave = path.join(os.tmpdir(), `aws-cache-decompress`);
  let fileContent = 'console.log(123)';
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
    awsCache = new AwsCache(config, new MessageReporter(new Logger()));

    fs.mkdirSync(cacheDirectory, {
      recursive: true,
    });
    fs.mkdirSync(cacheDirectorySave, {
      recursive: true,
    });
    const fileDir = path.join(cacheDirectory, `${hash}/outputs`);
    fs.mkdirSync(fileDir, { recursive: true });
    filePath = path.join(fileDir, `test.js`);
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

  it('Check that file is encrypted in s3 at rest', async () => {
    await awsCache.store(hash, cacheDirectory);

    // Check that file is encrypted in s3
    const s3 = new S3Client({
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
      endpoint: config.awsEndpoint,
      forcePathStyle: config.awsForcePathStyle,
      region: config.awsRegion,
    });
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: config.awsBucket,
        Key: `${hash}.tar.gz`,
      }),
    );
    const decryptedPath = path.join(os.tmpdir(), `${hash}.decr`);
    const fileOutput = createWriteStream(decryptedPath);
    if (!response?.Body) throw new Error('Cant get file from s3');

    const pipelinePromise = promisify(pipeline);
    try {
      await pipelinePromise(
        response.Body as Readable,
        new Decrypt(new EncryptConfig(config.encryptionFileKey)),
        fileOutput,
      );
    } catch (err) {
      if (err instanceof Error) throw new Error(`Cant decrypt file from s3, ${err?.message}`);
      else throw err;
    }
  });
});
