import { lookup } from 'node:dns/promises';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { decodeImage } from './public.server';

const MAX_BYTES = 2_000_000;
const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
// Transition mechanisms can tunnel requests to embedded IPv4 addresses.
blocked.addSubnet('2001::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

export function isPublicImageAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalIpv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

/** Legacy Workspace.image may be a URL. Fetch only public HTTP(S) addresses,
 * pin DNS results to the request (no rebinding), and recheck every redirect.
 * No credentials/cookies are forwarded. Print uses the same bounded loader.
 */
export async function loadWorkspaceImage(raw: string | null | undefined, redirects = 0): Promise<ReturnType<typeof decodeImage>> {
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return decodeImage(raw);
  try {
    const url = new URL(raw);
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || (url.port && !['80', '443'].includes(url.port))) return null;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(hostname) && !isPublicImageAddress(hostname)) return null;
    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    return await new Promise((resolve) => {
      const request = get(
        url,
        {
          agent: false,
          signal: AbortSignal.timeout(5_000),
          lookup: (host, options, callback) => {
            void lookup(host, { all: true })
              .then((addresses) => {
                if (!addresses.length || addresses.some(({ address }) => !isPublicImageAddress(address))) {
                  callback(new Error('Non-public image address'), '', 4);
                  return;
                }
                const first = addresses[0];
                if (options.all) callback(null, [first]);
                else callback(null, first.address, first.family);
              })
              .catch((error: Error) => callback(error, '', 4));
          },
        },
        (response) => {
          if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
            response.destroy();
            const location = response.headers.location;
            if (!location || redirects >= 2) {
              resolve(null);
              return;
            }
            // Re-enter the URL checks; never pass a non-HTTP redirect to decodeImage.
            try {
              const target = new URL(location, url);
              resolve(/^https?:$/.test(target.protocol) ? loadWorkspaceImage(target.href, redirects + 1) : null);
            } catch {
              resolve(null);
            }
            return;
          }
          const contentType = response.headers['content-type']?.split(';')[0].trim().toLowerCase() ?? '';
          if (
            response.statusCode !== 200 ||
            !/^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/.test(contentType) ||
            Number(response.headers['content-length'] ?? 0) > MAX_BYTES
          ) {
            response.destroy();
            resolve(null);
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BYTES) {
              response.destroy();
              resolve(null);
            } else chunks.push(chunk);
          });
          response.on('end', () => resolve(size ? { contentType, bytes: Buffer.concat(chunks) } : null));
          response.on('error', () => resolve(null));
          response.on('close', () => resolve(null));
        },
      );
      request.on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}
