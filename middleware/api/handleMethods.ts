import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { constants as HttpStatus } from 'http2';

export const withHttpMethods = (handlers: Partial<Record<HTTPMethod, (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | undefined>>) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = req.method as HTTPMethod | undefined;
    if (!method) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'No HTTP method specified' });
    }

    const handler = handlers[method];
    if (!handler) {
      return res.status(HttpStatus.HTTP_STATUS_METHOD_NOT_ALLOWED).json({ message: 'No handler specified for HTTP method' });
    }

    try {
      return handler(req, res);
    } catch (error) {
      console.error(error);
      return res.status(HttpStatus.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ message: 'Internal error occurred!' });
    }
  };
};
