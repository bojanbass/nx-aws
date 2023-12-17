import { Transform } from 'stream';
import { createDecipheriv, Decipher } from 'crypto';
import { EncryptConfig } from './encrypt-config';

/**
 * Stream transform for decrypt file. Get IV for file from first 16 bytes
 */
export class Decrypt extends Transform {
  private decipher: Decipher | null = null;
  private readFirstChunk = false;

  constructor(private config: EncryptConfig) {
    super();
  }

  _flush(callback: any) {
    const finalChunk = this.decipher?.final();
    this.push(finalChunk);
    callback();
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    if (!this.readFirstChunk && chunk.length >= this.config.getIvBytes()) {
      this.readFirstChunk = true;
      // Get iv from first bytes
      const iv = chunk.slice(0, this.config.getIvBytes());
      const firstPaylaod = chunk.slice(this.config.getIvBytes(), chunk.length);
      this.decipher = createDecipheriv(this.config.getAlgorithm(), this.config.getKeyBuffer(), iv);

      const decryptedData = this.decipher.update(firstPaylaod);
      this.push(decryptedData, encoding);
      callback();
      return;
    } else if (this.decipher) {
      // Next chunk decrypt as normal
      this.push(this.decipher.update(chunk, encoding));
      callback();
      return;
    }

    callback(new Error('No set Decipher'));
  }
}
