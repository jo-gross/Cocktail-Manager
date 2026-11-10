import { describe, expect, it, vi } from 'vitest';
import { WorkspaceUpdateSchema } from '@lib/schemas/workspace';

vi.mock('../../../prisma/prisma', () => ({ default: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '127.0.0.1', family: 4 }]) }));

const { decodeImage } = await import('../public.server');
const { isPublicImageAddress, loadWorkspaceImage } = await import('../workspaceImage.server');

describe('workspace logo storage and public image safety', () => {
  it('accepts an uploaded logo, removal and unrelated partial updates', () => {
    expect(WorkspaceUpdateSchema.safeParse({ image: 'data:image/png;base64,AAAA' }).success).toBe(true);
    expect(WorkspaceUpdateSchema.parse({ image: null }).image).toBeNull();
    expect(WorkspaceUpdateSchema.parse({ name: 'Bar' }).image).toBeUndefined();
    expect(WorkspaceUpdateSchema.safeParse({ image: 'https://example.org/logo.png' }).success).toBe(false);
    expect(WorkspaceUpdateSchema.safeParse({ image: 'data:text/html;base64,AAAA' }).success).toBe(false);
  });

  it('decodes legacy base64 and data URIs but never treats URLs as base64', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    expect(decodeImage(pngBase64)?.contentType).toBe('image/png');
    expect(decodeImage('data:image/png;base64,AAAA')?.contentType).toBe('image/png');
    expect(decodeImage('https://example.org/logo.png')).toBeNull();
    expect(decodeImage('/api/private/image')).toBeNull();
    expect(decodeImage('/api/logo123')).toBeNull();
    expect(decodeImage('AAAA')).toBeNull();
    expect(decodeImage('data:image/svg+xml,%ZZ')).toBeNull();
    expect(await loadWorkspaceImage(`data:image/png;base64,${pngBase64}`)).toEqual(decodeImage(pngBase64));
  });

  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2002:7f00:1::',
  ])('blocks non-public address %s', (address) => {
    expect(isPublicImageAddress(address)).toBe(false);
  });

  it('allows public addresses', () => {
    expect(isPublicImageAddress('8.8.8.8')).toBe(true);
    expect(isPublicImageAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('does not fetch private hosts, credentials or unsupported protocols', async () => {
    expect(await loadWorkspaceImage('http://127.0.0.1/logo.png')).toBeNull();
    expect(await loadWorkspaceImage('http://[::1]/logo.png')).toBeNull();
    expect(await loadWorkspaceImage('http://private.example/logo.png')).toBeNull();
    expect(await loadWorkspaceImage('https://user:secret@example.org/logo.png')).toBeNull();
    expect(await loadWorkspaceImage('file:///etc/passwd')).toBeNull();
  });
});
