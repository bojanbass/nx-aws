export const IVBYTES = 16;

export class EncryptConfig {
  constructor(
    private key = '',
    private algorithm = 'aes-256-cbc',
    private ivBytes = IVBYTES,
  ) {}

  getKey() {
    return this.key;
  }

  getAlgorithm() {
    return this.algorithm;
  }

  getIvBytes() {
    return this.ivBytes;
  }
}
