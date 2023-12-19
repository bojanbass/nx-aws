import { Encrypt } from './encrypt';
import { randomBytes, createDecipheriv, createCipheriv } from 'crypto';
import { createReadStream, createWriteStream, readFileSync } from 'fs';
import { Readable, Writable } from 'stream';
import { Decrypt } from './decrypt';
import { EncryptConfig } from './encrypt-config';

const keyLength = 32;
const ivLength = 16;
const algo = 'aes-256-cbc';

class TestCipher {
  // eslint-disable-next-line no-useless-constructor
  constructor(private algorithm: string, private key: Buffer, private iv: Buffer) {}

  encrypt(data: Buffer) {
    const cipher = createCipheriv(this.algorithm, this.key, this.iv);
    const encrypted = cipher.update(data);
    return Buffer.concat([encrypted, cipher.final()]);
  }

  decrypt(encryptedData: Buffer) {
    const decipher = createDecipheriv(this.algorithm, this.key, this.iv);
    const decrypted = decipher.update(encryptedData);
    return Buffer.concat([decrypted, decipher.final()]);
  }
}

// eslint-disable-next-line max-lines-per-function
describe('Encryptor tests', () => {
  let testData: Buffer;
  let encrypt: Encrypt;
  let decrypt: Decrypt;
  let testCipher: TestCipher;
  const key = randomBytes(keyLength);
  const iv = randomBytes(ivLength);

  beforeEach(() => {
    const config = new EncryptConfig(key.toString('base64'), algo, ivLength);
    // eslint-disable-next-line max-len
    testData = Buffer.from(
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
    );
    encrypt = new Encrypt(config);
    decrypt = new Decrypt(config);
    encrypt.generateIv = () => iv;
    testCipher = new TestCipher(algo, key, iv);
  });

  it('Test TestCipher', () => {
    const enc = testCipher.encrypt(Buffer.from('data'));
    expect(testCipher.decrypt(enc).toString()).toBe('data');
  });

  it('Should encrypt stream', (done) => {
    const input = Readable.from(testData);
    const writable = createWriteStream('/tmp/enc.test');
    input.pipe(encrypt).pipe(writable);

    writable.on('finish', () => {
      const encryptedData = readFileSync('/tmp/enc.test');
      const ivFromFirstBytes = encryptedData.slice(0, ivLength);
      const encryptedPayload = encryptedData.slice(ivLength, encryptedData.length);
      expect(ivFromFirstBytes.equals(iv)).toBeTruthy();
      expect(testCipher.encrypt(testData).equals(encryptedData));
      expect(testCipher.decrypt(encryptedPayload).equals(testData));
      done();
    });
  });

  it('Should decrypt stream', (done) => {
    const filePath = '/tmp/decr.test';
    const input = Readable.from(testData);
    const fileOutput = createWriteStream(filePath);

    const chunks: Array<Buffer> = [];
    const writable = new Writable({
      write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        chunks.push(chunk);
        callback();
      },
    });

    input.pipe(encrypt).pipe(fileOutput);
    fileOutput.on('finish', () => {
      const fileInput = createReadStream(filePath);
      fileInput.pipe(decrypt).pipe(writable);
      writable.on('finish', () => {
        const decrypted = Buffer.concat(chunks);
        expect(decrypted.equals(testData)).toBeTruthy();
        done();
      });
    });
  });
});
