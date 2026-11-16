import { describe, expect, it } from 'vitest';
import { classifyRequestError, isAbortError, isFetchNetworkError, shouldAlertRequestError } from '../requestErrors';
import { ApiV1RequestError } from '../apiV1';

describe('classifyRequestError', () => {
  it('detects aborted requests (DOMException and plain errors)', () => {
    expect(classifyRequestError(new DOMException('The user aborted a request.', 'AbortError'))).toBe('aborted');
    const error = new Error('aborted');
    error.name = 'AbortError';
    expect(classifyRequestError(error)).toBe('aborted');
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
  });

  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'The network connection was lost.',
    'cancelled',
    'Network request failed',
    'fetch failed',
  ])('detects the fetch network failure "%s"', (message) => {
    expect(classifyRequestError(new TypeError(message))).toBe('network');
  });

  it('does not treat programming TypeErrors as network failures', () => {
    expect(isFetchNetworkError(new TypeError("Cannot read properties of undefined (reading 'data')"))).toBe(false);
    expect(classifyRequestError(new TypeError('x is not a function'))).toBe('unknown');
    expect(isFetchNetworkError(new Error('Failed to fetch'))).toBe(false);
  });

  it('detects server error responses', () => {
    expect(classifyRequestError(new ApiV1RequestError(500, 'ERROR', 'boom'))).toBe('http');
  });

  it('falls back to unknown', () => {
    expect(classifyRequestError(new SyntaxError('Unexpected token < in JSON'))).toBe('unknown');
    expect(classifyRequestError(undefined)).toBe('unknown');
    expect(classifyRequestError('Failed to fetch')).toBe('unknown');
  });
});

describe('shouldAlertRequestError', () => {
  it('never alerts aborted requests', () => {
    expect(shouldAlertRequestError(new DOMException('aborted', 'AbortError'), true)).toBe(false);
  });

  it('alerts network failures only while online (offline banner covers the rest)', () => {
    expect(shouldAlertRequestError(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(shouldAlertRequestError(new TypeError('Failed to fetch'), false)).toBe(false);
  });

  it('alerts server and unknown errors regardless of connectivity', () => {
    expect(shouldAlertRequestError(new ApiV1RequestError(503, 'ERROR', 'down'), false)).toBe(true);
    expect(shouldAlertRequestError(new SyntaxError('bad json'), false)).toBe(true);
  });
});
