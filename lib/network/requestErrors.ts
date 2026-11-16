/**
 * Classification of failed client-side requests (pure, unit-tested).
 *
 * - `aborted`: the request was cancelled on purpose (AbortController, unmount) – never user facing.
 * - `network`: `fetch` itself rejected (offline, connection reset, or the browser cancelled the
 *   request because the page reloads/navigates away – Firefox and Safari reject these while the old
 *   page is still running).
 * - `http`: the server answered with an error status (e.g. `ApiV1RequestError`).
 * - `unknown`: anything else (parse errors, bugs).
 */
export type RequestErrorKind = 'aborted' | 'network' | 'http' | 'unknown';

/** `TypeError` messages of a rejected `fetch` per engine (Chromium, Firefox, Safari, React Native, Node). */
const NETWORK_ERROR_MESSAGES = [
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Load failed',
  'The network connection was lost.',
  'cancelled',
  'Network request failed',
  'fetch failed',
];

function errorName(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') return error.name;
  return undefined;
}

export function isAbortError(error: unknown): boolean {
  return errorName(error) === 'AbortError';
}

export function isFetchNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return NETWORK_ERROR_MESSAGES.includes(error.message) || error.message.startsWith('NetworkError');
}

export function classifyRequestError(error: unknown): RequestErrorKind {
  if (isAbortError(error)) return 'aborted';
  if (isFetchNetworkError(error)) return 'network';
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') return 'http';
  return 'unknown';
}

/**
 * Whether a failed request deserves its own error alert. Aborted requests are intentional and a
 * network failure while the browser is offline is already shown by the offline banner.
 */
export function shouldAlertRequestError(error: unknown, online: boolean = typeof navigator === 'undefined' || navigator.onLine !== false): boolean {
  const kind = classifyRequestError(error);
  if (kind === 'aborted') return false;
  if (kind === 'network' && !online) return false;
  return true;
}
