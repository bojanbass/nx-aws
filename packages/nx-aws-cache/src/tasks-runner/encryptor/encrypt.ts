import { createCipheriv, createSecretKey, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import type { EncryptConfig } from './encrypt-config';

export function createEncryptStream(
  source: Readable,
  config: EncryptConfig,
  iv?: Uint8Array<ArrayBuffer>,
): Readable {
  return Readable.from(
    (async function* () {
      const actualIv = iv ?? Uint8Array.from(randomBytes(config.getIvBytes()));
      const key = createSecretKey(config.getKey(), 'base64');
      const cipher = createCipheriv(config.getAlgorithm(), key, actualIv);

      yield actualIv;

      for await (const chunk of source) {
        yield cipher.update(Uint8Array.from(chunk as Buffer));
      }

      yield cipher.final();
    })(),
  );
}
