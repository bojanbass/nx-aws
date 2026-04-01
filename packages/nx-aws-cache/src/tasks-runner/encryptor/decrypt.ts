import { createDecipheriv, createSecretKey } from 'node:crypto';
import { Readable } from 'node:stream';
import type { EncryptConfig } from './encrypt-config';

export function createDecryptStream(source: Readable, config: EncryptConfig): Readable {
  return Readable.from(
    (async function* () {
      const key = createSecretKey(config.getKey(), 'base64');
      let ivBuffer = Buffer.alloc(0);
      let decipher: ReturnType<typeof createDecipheriv> | null = null;

      for await (const chunk of source) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);

        if (decipher === null) {
          ivBuffer = Buffer.concat([ivBuffer, buf]);

          if (ivBuffer.length >= config.getIvBytes()) {
            const iv = Uint8Array.from(ivBuffer.subarray(0, config.getIvBytes()));
            decipher = createDecipheriv(config.getAlgorithm(), key, iv);
            const rest = ivBuffer.subarray(config.getIvBytes());
            if (rest.length > 0) {
              yield decipher.update(Uint8Array.from(rest));
            }
          }
        } else {
          yield decipher.update(Uint8Array.from(buf));
        }
      }

      if (decipher !== null) {
        yield decipher.final();
      }
    })(),
  );
}
