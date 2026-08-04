import { describe, it, expect, beforeEach } from 'vitest';
import type { NextApiRequest } from 'next';
import { isMasterApiKey, createApiKeyJwt } from '../jwtApiKeyMiddleware';
import { TEST_JWT_SECRET, TEST_MASTER_API_KEY } from '../../../test/helpers/authFixtures';

describe('jwtApiKeyMiddleware', () => {
  beforeEach(() => {
    process.env.API_KEY_JWT_SECRET = TEST_JWT_SECRET;
    process.env.INSTANCE_MASTER_API_KEY = TEST_MASTER_API_KEY;
  });

  describe('isMasterApiKey', () => {
    it('returns true for the configured master key', () => {
      expect(isMasterApiKey(TEST_MASTER_API_KEY)).toBe(true);
    });

    it('returns false for a wrong key', () => {
      expect(isMasterApiKey('wrong-key')).toBe(false);
    });

    it('returns false when master key env is unset', () => {
      delete process.env.INSTANCE_MASTER_API_KEY;
      expect(isMasterApiKey(TEST_MASTER_API_KEY)).toBe(false);
    });
  });

  describe('createApiKeyJwt', () => {
    it('creates a JWT with api-key type claim', () => {
      const token = createApiKeyJwt('key_test', 'ws_test', ['GLASSES_READ']);
      expect(token.split('.')).toHaveLength(3);
    });
  });
});

describe('checkMasterApiKey via request', () => {
  beforeEach(() => {
    process.env.INSTANCE_MASTER_API_KEY = TEST_MASTER_API_KEY;
  });

  it('recognizes Bearer master key in Authorization header', async () => {
    const { checkMasterApiKey } = await import('../jwtApiKeyMiddleware');
    const req = {
      headers: { authorization: `Bearer ${TEST_MASTER_API_KEY}` },
    } as unknown as NextApiRequest;
    expect(checkMasterApiKey(req)).toBe(true);
  });
});
