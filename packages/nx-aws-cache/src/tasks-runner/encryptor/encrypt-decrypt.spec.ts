import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDecryptStream } from './decrypt';
import { createEncryptStream } from './encrypt';
import { EncryptConfig } from './encrypt-config';

const keyLength = 32;
const ivLength = 16;
const algo = 'aes-256-cbc';

class TestCipher {
  private key: Uint8Array<ArrayBuffer>;
  private iv: Uint8Array<ArrayBuffer>;

  constructor(
    private algorithm: string,
    key: Buffer,
    iv: Buffer,
  ) {
    this.key = Uint8Array.from(key);
    this.iv = Uint8Array.from(iv);
  }

  encrypt(data: Buffer) {
    const cipher = createCipheriv(this.algorithm, createSecretKey(this.key), this.iv);
    return Buffer.concat([cipher.update(Uint8Array.from(data)), cipher.final()]);
  }

  decrypt(encryptedData: Buffer) {
    const decipher = createDecipheriv(this.algorithm, createSecretKey(this.key), this.iv);
    return Buffer.concat([decipher.update(Uint8Array.from(encryptedData)), decipher.final()]);
  }
}

describe('Encryptor tests', () => {
  let testData: Buffer;
  let config: EncryptConfig;
  let iv: Buffer;
  let testCipher: TestCipher;

  beforeEach(() => {
    const key = randomBytes(keyLength);
    iv = randomBytes(ivLength);
    config = new EncryptConfig(key.toString('base64'), algo, ivLength);
    testData = Buffer.from(
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
    );
    testCipher = new TestCipher(algo, key, iv);
  });

  it('Test TestCipher', () => {
    const enc = testCipher.encrypt(Buffer.from('data'));
    expect(testCipher.decrypt(enc).toString()).toBe('data');
  });

  it('Should encrypt stream', () =>
    new Promise<void>((resolve, reject) => {
      const input = Readable.from(testData);
      const writable = createWriteStream('/tmp/enc.test');
      createEncryptStream(input, config, Uint8Array.from(iv)).pipe(writable);

      writable.on('error', reject);
      writable.on('finish', () => {
        try {
          const encryptedData = readFileSync('/tmp/enc.test');
          const ivFromFirstBytes = encryptedData.slice(0, ivLength);
          const encryptedPayload = encryptedData.slice(ivLength);
          expect(ivFromFirstBytes.equals(iv)).toBeTruthy();
          expect(testCipher.decrypt(encryptedPayload).equals(testData)).toBeTruthy();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }));

  it('Should decrypt stream', () =>
    new Promise<void>((resolve, reject) => {
      const filePath = '/tmp/decr.test';
      const input = Readable.from(testData);
      const fileOutput = createWriteStream(filePath);

      const chunks: Array<Buffer> = [];
      const writable = new Writable({
        write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
          chunks.push(chunk);
          callback();
        },
      });

      createEncryptStream(input, config, Uint8Array.from(iv)).pipe(fileOutput);
      fileOutput.on('error', reject);
      fileOutput.on('finish', () => {
        const fileInput = createReadStream(filePath);
        createDecryptStream(fileInput, config).pipe(writable);
        writable.on('error', reject);
        writable.on('finish', () => {
          try {
            const decrypted = Buffer.concat(chunks);
            expect(decrypted.equals(testData)).toBeTruthy();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }));
});
