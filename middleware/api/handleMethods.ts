import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { constants as HttpStatus } from 'http2';
import { sendFail } from '@lib/http/responses';
import { prismaErrorToApiError } from '@lib/http/prismaErrors';

export const withHttpMethods = (handlers: Partial<Record<HTTPMethod, (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | undefined>>) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = req.method as HTTPMethod | undefined;
    if (!method) {
      return sendFail(res, HttpStatus.HTTP_STATUS_BAD_REQUEST, 'BAD_REQUEST', 'No HTTP method specified');
    }

    const handler = handlers[method];
    if (!handler) {
      res.setHeader?.('Allow', Object.keys(handlers).join(', '));
      return sendFail(res, HttpStatus.HTTP_STATUS_METHOD_NOT_ALLOWED, 'METHOD_NOT_ALLOWED', 'No handler specified for HTTP method');
    }

    try {
      return await handler(req, res);
    } catch (error) {
      if (res.headersSent) {
        console.error('Handler error after response was sent:', error);
        return undefined;
      }
      const apiError = prismaErrorToApiError(error);
      if (apiError) {
        return sendFail(res, apiError.status, apiError.code, apiError.message, apiError.issues);
      }
      console.error(error);
      return sendFail(res, HttpStatus.HTTP_STATUS_INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Internal error occurred!');
    }
  };
};
