import {Writable} from "stream";
import {createDecipheriv, Decipher} from "crypto";


export class Decrypt extends Writable {

    private decipher: Decipher;
    private readFirstChunk = false;

    constructor (
    private encryptionFileKey = "",
    private encryptionAlgorithm = "aes-256-cbc",
    private iv_bytes = 16
    ) {}


    _write (chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {

        if (!this.readFirstChunk && chunk.length > 0) {

            const iv = chunk.splice(0, this.iv_bytes);

            this.decipher = createDecipheriv(
                this.encryptionAlgorithm,
                Buffer.from(this.encryptionFileKey, "base64"),
                iv
            );
            this.readFirstChunk = true;
            this.decipher.push(chunk);

        } else {

            this.decipher.push(chunk);

        }

        callback();

    }

}
