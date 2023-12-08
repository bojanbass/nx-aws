import {pipeline, Writable, Readable} from "stream";
import crypto from "crypto";
import {createReadStream} from "fs";
import {Decrypt} from "./Decrypt";


export class Encrypt {

    constructor (
      private encryptionFileKey = "",
      private encryptionAlgorithm = "aes-256-cbc",
      private iv_bytes = 16
    ) {

    }

    async encryptFile (filePath: string): Promise<Readable> {

        const iv = crypto.randomBytes(this.iv_bytes);
        const encrypt = crypto.createCipheriv(this.encryptionAlgorithm, Buffer.from(this.encryptionFileKey, "base64"), iv);
        const readStream = createReadStream(filePath);
        // Update initialization vector as first IV_BYTES_NUM bytes
        encrypt.update(iv);
        await pipeline(readStream, encrypt);
        return readStream;

    }

    createDecryptStream (): Writable {

        return new Decrypt(this.encryptionFileKey, this.encryptionAlgorithm);

    }

}
