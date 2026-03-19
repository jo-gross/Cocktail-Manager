import { describe, it, expect, vi } from 'vitest';
import { apiError, apiSuccess, apiBadRequest, apiNotFound, apiUnauthorized, apiInternalError } from '../apiResponses';

function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as import('next').NextApiResponse;
}

describe('apiResponses', () => {
  describe('apiError', () => {
    it('should set status and return error json', () => {
      const res = createMockResponse();
      apiError(res, 400, 'Bad request');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: { message: 'Bad request', status: 400 } });
    });
  });

  describe('apiSuccess', () => {
    it('should return data json', () => {
      const res = createMockResponse();
      apiSuccess(res, { id: '1', name: 'Test' });
      expect(res.json).toHaveBeenCalledWith({ data: { id: '1', name: 'Test' } });
    });
  });

  describe('apiBadRequest', () => {
    it('should return 400 status', () => {
      const res = createMockResponse();
      apiBadRequest(res, 'Missing field');
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('apiNotFound', () => {
    it('should return 404 status', () => {
      const res = createMockResponse();
      apiNotFound(res, 'Not found');
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('apiUnauthorized', () => {
    it('should return 401 status', () => {
      const res = createMockResponse();
      apiUnauthorized(res, 'Unauthorized');
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('apiInternalError', () => {
    it('should return 500 status', () => {
      const res = createMockResponse();
      apiInternalError(res, 'Server error');
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
