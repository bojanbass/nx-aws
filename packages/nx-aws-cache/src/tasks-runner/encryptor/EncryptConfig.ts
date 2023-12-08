export const IVBYTES = 16;


export class EncryptConfig {

    private keyBuffer: Buffer;
    constructor (
    private key = "",
    private algorithm = "aes-256-cbc",
    private ivBytes = IVBYTES
    ) {

        this.keyBuffer = Buffer.from(key, "base64");

    }

    getKey () {

        return this.key;

    }

    getKeyBuffer () {

        return this.keyBuffer;

    }

    getAlgorithm () {

        return this.algorithm;

    }

    getIvBytes () {

        return this.ivBytes;

    }

}
