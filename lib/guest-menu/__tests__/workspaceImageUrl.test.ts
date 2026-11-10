import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import type { LookupFunction } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../prisma/prisma', () => ({ default: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('node:http', () => ({ get: vi.fn() }));
vi.mock('node:https', () => ({ get: vi.fn() }));

const { lookup } = await import('node:dns/promises');
const { get: httpGet } = await import('node:http');
const { get: httpsGet } = await import('node:https');
const { loadWorkspaceImage } = await import('../workspaceImage.server');

type Reply = { status?: number; headers?: Record<string, string>; body?: Buffer };
let replies: Reply[];
let pinnedAddresses: string[];

function mockGet(url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void): ClientRequest {
  const request = new EventEmitter();
  queueMicrotask(() => {
    (options.lookup as LookupFunction)(url.hostname, { all: false }, (error, address) => {
      if (error) {
        request.emit('error', error);
        return;
      }
      pinnedAddresses.push(String(address));
      const reply = replies.shift() ?? {};
      const response = Object.assign(new EventEmitter(), {
        statusCode: reply.status ?? 200,
        headers: reply.headers ?? { 'content-type': 'image/png' },
        destroy: vi.fn(),
      });
      onResponse(response as unknown as IncomingMessage);
      if (reply.body) response.emit('data', reply.body);
      response.emit('end');
      response.emit('close');
    });
  });
  return request as ClientRequest;
}

describe('URL-backed workspace logos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replies = [{ body: Buffer.from('image bytes') }];
    pinnedAddresses = [];
    vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    vi.mocked(httpGet).mockImplementation(mockGet as typeof httpGet);
    vi.mocked(httpsGet).mockImplementation(mockGet as typeof httpsGet);
  });

  it('loads an image using a pinned public DNS address', async () => {
    expect(await loadWorkspaceImage('https://images.example/logo.png')).toEqual({ contentType: 'image/png', bytes: Buffer.from('image bytes') });
    expect(pinnedAddresses).toEqual(['8.8.8.8']);
  });

  it('rejects DNS answers containing even one private address', async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    expect(await loadWorkspaceImage('https://images.example/logo.png')).toBeNull();
    expect(pinnedAddresses).toEqual([]);
  });

  it('rechecks redirect targets before making another request', async () => {
    replies = [{ status: 302, headers: { location: 'http://169.254.169.254/secret' } }];
    expect(await loadWorkspaceImage('https://images.example/logo.png')).toBeNull();
    expect(httpGet).not.toHaveBeenCalled();
    expect(httpsGet).toHaveBeenCalledTimes(1);
  });

  it('follows bounded public redirects', async () => {
    replies = [{ status: 302, headers: { location: '/new.png' } }, { body: Buffer.from('new image') }];
    expect((await loadWorkspaceImage('https://images.example/logo.png'))?.bytes.toString()).toBe('new image');
    expect(httpsGet).toHaveBeenCalledTimes(2);
  });

  it.each([
    { headers: { 'content-type': 'text/html' }, body: Buffer.from('<html>') },
    { headers: { 'content-type': 'image/png', 'content-length': '2000001' } },
    { body: Buffer.alloc(2_000_001) },
    { status: 302, headers: { location: 'file:///etc/passwd' } },
  ])('rejects unsafe or oversized remote responses', async (reply) => {
    replies = [reply];
    expect(await loadWorkspaceImage('https://images.example/logo.png')).toBeNull();
  });
});
