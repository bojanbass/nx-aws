import {Transform, TransformCallback} from "stream";
import {createCipheriv, Cipher, randomBytes} from "crypto";
import {EncryptConfig} from "./EncryptConfig";


export class Encrypt extends Transform {

    private cipher: Cipher | null = null;
    private readFirstChunk = false;

    constructor (private config: EncryptConfig) {

        super();

    }


    _flush (callback: any) {

        const finalChunk = this.cipher?.final();
        this.push(finalChunk);
        callback();

    }

    _transform (chunk: any, encoding: BufferEncoding, done: TransformCallback) {

        this.readFirstChunk = false;

        const iv = this.generateIv();
        if (!this.readFirstChunk && chunk.length > 0) {

            this.readFirstChunk = true;

            this.cipher = createCipheriv(
                this.config.getAlgorithm(),
                this.config.getKeyBuffer(),
                iv
            );
            // As first push iv
            this.push(iv, encoding);
            const encrypted = this.cipher.update(chunk);
            this.push(encrypted, encoding);
            done();


        } else if (this.cipher) {

            const encrypted = this.cipher.update(chunk);
            this.push(encrypted, encoding);
            done();

        } else {

            done(new Error("No create decipher"));

        }

    }

    generateIv () {

        return randomBytes(this.config.getIvBytes());

    }

}
