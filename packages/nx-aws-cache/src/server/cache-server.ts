import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createS3Client, splitBucket } from '../s3';
import { createDecryptStream, createEncryptStream, EncryptConfig } from '../tasks-runner/encryptor';
import type { AwsNxCacheOptions } from '../tasks-runner/models/aws-nx-cache-options.model';

export interface CacheServerOptions extends AwsNxCacheOptions {
  /** Token granting read and write access. */
  accessToken?: string;
  /** Token granting read-only access (e.g. for local development machines). */
  readOnlyAccessToken?: string;
  /** Maximum accepted artifact size in bytes. Unlimited when not set. */
  maxUploadBytes?: number;
  /** Custom S3 client, mainly for testing. */
  s3Client?: S3Client;
  log?: (message: string) => void;
}

type Access = 'none' | 'read' | 'write';

const CACHE_ROUTE = /^\/v1\/cache\/([^/?#]+)$/u;
const VALID_HASH = /^[A-Za-z0-9_-]{1,256}$/u;

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function tokenMatches(provided: Buffer, expected: string | undefined): boolean {
  return expected !== undefined && expected !== '' && timingSafeEqual(provided, digest(expected));
}

function isNotFound(err: unknown): boolean {
  const { name, $metadata } = err as { name?: string; $metadata?: { httpStatusCode?: number } };

  return name === 'NotFound' || name === 'NoSuchKey' || $metadata?.httpStatusCode === 404;
}

function send(res: ServerResponse, status: number, message = ''): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

/**
 * HTTP server implementing the Nx self-hosted remote cache OpenAPI specification
 * (Nx >= 20.8, `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`), storing artifacts in S3.
 */
export function createCacheServer(options: CacheServerOptions): Server {
  if (!options.awsBucket) {
    throw new Error('Missing AWS bucket (NXCACHE_AWS_BUCKET)');
  }

  if (!options.accessToken && !options.readOnlyAccessToken) {
    throw new Error(
      'Missing access token (NXCACHE_SERVER_ACCESS_TOKEN and/or NXCACHE_SERVER_READ_ONLY_ACCESS_TOKEN)',
    );
  }

  const { bucket, path } = splitBucket(options.awsBucket);
  const s3 = options.s3Client ?? createS3Client(options);
  const encryptConfig = options.encryptionFileKey
    ? new EncryptConfig(options.encryptionFileKey)
    : undefined;
  const log = options.log ?? (() => undefined);

  // Artifacts use a different format than the ones stored by the legacy tasks runner,
  // so they are kept under a separate prefix.
  const getKey = (hash: string) => [path, 'v1', hash].filter(Boolean).join('/');

  const getAccess = (req: IncomingMessage): Access => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return 'none';
    }

    const provided = digest(token);

    if (tokenMatches(provided, options.accessToken)) {
      return 'write';
    }

    return tokenMatches(provided, options.readOnlyAccessToken) ? 'read' : 'none';
  };

  const exists = async (key: string): Promise<boolean> => {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) {
        return false;
      }
      throw err;
    }
  };

  const retrieve = async (hash: string, res: ServerResponse): Promise<void> => {
    let body: Readable;
    let contentLength: number | undefined;

    try {
      const output = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: getKey(hash) }));
      body = output.Body as Readable;
      contentLength = output.ContentLength;
    } catch (err) {
      if (isNotFound(err)) {
        log(`MISS ${hash}`);
        return send(res, 404, 'Not found');
      }
      throw err;
    }

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      // The decrypted size is unknown upfront, so the response is chunked.
      ...(encryptConfig || contentLength === undefined ? {} : { 'Content-Length': contentLength }),
    });
    await pipeline(encryptConfig ? createDecryptStream(body, encryptConfig) : body, res);
    log(`HIT ${hash}`);
  };

  const store = async (hash: string, req: IncomingMessage, res: ServerResponse) => {
    const contentLength = Number(req.headers['content-length']);

    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return send(res, 411, 'Content-Length header is required');
    }

    if (options.maxUploadBytes !== undefined && contentLength > options.maxUploadBytes) {
      return send(res, 413, 'Artifact is too large');
    }

    const key = getKey(hash);

    if (await exists(key)) {
      // Cache records are immutable.
      return send(res, 409, 'Cannot override an existing record');
    }

    await new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: encryptConfig ? createEncryptStream(req, encryptConfig) : req,
        ...(encryptConfig ? {} : { ContentLength: contentLength }),
      },
    }).done();

    log(`STORED ${hash}`);
    send(res, 200);
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health') {
      return send(res, 200, 'OK');
    }

    const match = CACHE_ROUTE.exec(url.pathname);

    if (!match) {
      return send(res, 404, 'Not found');
    }

    const hash = match[1];

    if (!VALID_HASH.test(hash)) {
      return send(res, 400, 'Invalid hash');
    }

    if (req.method !== 'GET' && req.method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT');
      return send(res, 405, 'Method not allowed');
    }

    const access = getAccess(req);

    if (access === 'none') {
      return send(res, 401, 'Missing or invalid access token');
    }

    if (req.method === 'GET') {
      return retrieve(hash, res);
    }

    if (access !== 'write') {
      return send(res, 403, 'Access token is read-only');
    }

    return store(hash, req, res);
  };

  return createServer((req, res) => {
    handle(req, res)
      .catch((err: Error) => {
        log(`ERROR ${req.method} ${req.url} - ${err.message}`);

        if (!res.headersSent) {
          send(res, 500, `Remote cache error - ${err.message}`);
        } else {
          res.destroy(err);
        }
      })
      .finally(() => {
        // Discard any unread request body (e.g. rejected uploads) so the connection can be reused.
        req.resume();
      });
  });
}
