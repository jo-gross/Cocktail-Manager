import { NextApiResponse } from 'next';

export function apiError(res: NextApiResponse, status: number, message: string) {
  return res.status(status).json({ error: { message, status } });
}

export function apiSuccess<T>(res: NextApiResponse, data: T) {
  return res.json({ data });
}

export function apiBadRequest(res: NextApiResponse, message: string) {
  return apiError(res, 400, message);
}

export function apiNotFound(res: NextApiResponse, message: string) {
  return apiError(res, 404, message);
}

export function apiUnauthorized(res: NextApiResponse, message: string) {
  return apiError(res, 401, message);
}

export function apiInternalError(res: NextApiResponse, message: string) {
  return apiError(res, 500, message);
}
