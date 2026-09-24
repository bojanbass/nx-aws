import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@smithy/util-stream';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CacheServerOptions, createCacheServer } from './cache-server';

const WRITE_TOKEN = 'write-token';
const READ_TOKEN = 'read-token';
const HASH = '1234567890';

function notFound(): Error {
  return Object.assign(new Error('NotFound'), {
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  });
}

describe('cache server', () => {
  const s3Mock = mockClient(S3Client);
  let objects: Map<string, Buffer>;
  let server: Server;
  let baseUrl: string;

  async function start(options: Partial<CacheServerOptions> = {}) {
    server = createCacheServer({
      awsBucket: 'bucket/prefix',
      awsRegion: 'us-east-1',
      accessToken: WRITE_TOKEN,
      readOnlyAccessToken: READ_TOKEN,
      s3Client: new S3Client({ region: 'us-east-1' }),
      ...options,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function request(method: string, token?: string, body?: Buffer, path = `/v1/cache/${HASH}`) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  beforeEach(() => {
    objects = new Map();
    s3Mock.on(HeadObjectCommand).callsFake(({ Key }) => {
      if (!objects.has(Key)) {
        throw notFound();
      }
      return {};
    });
    s3Mock.on(PutObjectCommand).callsFake(async ({ Key, Body }) => {
      objects.set(Key, Buffer.from(Body));
      return {};
    });
    s3Mock.on(GetObjectCommand).callsFake(({ Key }) => {
      const data = objects.get(Key);
      if (!data) {
        throw Object.assign(notFound(), { name: 'NoSuchKey' });
      }
      return { Body: sdkStreamMixin(Readable.from([data])), ContentLength: data.length };
    });
  });

  afterEach(async () => {
    s3Mock.reset();
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('requires a bucket and an access token', () => {
    expect(() => createCacheServer({ accessToken: WRITE_TOKEN })).toThrow(/bucket/);
    expect(() => createCacheServer({ awsBucket: 'bucket' })).toThrow(/access token/);
  });

  it('stores and retrieves an artifact under the v1 prefix', async () => {
    await start();
    const artifact = Buffer.from('artifact-content');

    expect((await request('PUT', WRITE_TOKEN, artifact)).status).toBe(200);
    expect(objects.get(`prefix/v1/${HASH}`)).toEqual(artifact);

    const res = await request('GET', READ_TOKEN);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(artifact);
  });

  it('returns 404 for a cache miss', async () => {
    await start();

    expect((await request('GET', READ_TOKEN)).status).toBe(404);
  });

  it('returns 409 when the record already exists', async () => {
    await start();
    objects.set(`prefix/v1/${HASH}`, Buffer.from('existing'));

    expect((await request('PUT', WRITE_TOKEN, Buffer.from('new'))).status).toBe(409);
    expect(objects.get(`prefix/v1/${HASH}`)?.toString()).toBe('existing');
  });

  it('enforces authentication and read-only tokens', async () => {
    await start();

    expect((await request('GET')).status).toBe(401);
    expect((await request('GET', 'wrong')).status).toBe(401);
    expect((await request('PUT', READ_TOKEN, Buffer.from('x'))).status).toBe(403);
    expect(objects.size).toBe(0);
  });

  it('rejects invalid hashes and unknown routes', async () => {
    await start();

    expect((await request('GET', READ_TOKEN, undefined, '/v1/cache/..%2F..%2Fsecret')).status).toBe(
      400,
    );
    expect((await request('GET', READ_TOKEN, undefined, '/v1/other')).status).toBe(404);
    expect((await request('DELETE', WRITE_TOKEN)).status).toBe(405);
    expect((await request('GET', undefined, undefined, '/health')).status).toBe(200);
  });

  it('rejects artifacts over the size limit', async () => {
    await start({ maxUploadBytes: 4 });

    expect((await request('PUT', WRITE_TOKEN, Buffer.from('too-large'))).status).toBe(413);
    expect(objects.size).toBe(0);
  });

  it('encrypts artifacts at rest when an encryption key is set', async () => {
    await start({ encryptionFileKey: 'Pbfk58EpcK7IxTxWwSXNsTAKmzhJQE+99vkpGftyJg8=' });
    const artifact = Buffer.from('secret-artifact-content');

    expect((await request('PUT', WRITE_TOKEN, artifact)).status).toBe(200);
    expect(objects.get(`prefix/v1/${HASH}`)?.includes(artifact)).toBe(false);

    const res = await request('GET', WRITE_TOKEN);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(artifact);
  });
});
