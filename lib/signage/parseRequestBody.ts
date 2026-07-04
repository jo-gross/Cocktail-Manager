export function parseRequestBody<T>(body: unknown): T {
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }
  return body as T;
}
