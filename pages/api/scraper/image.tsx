import { withHttpMethods } from '../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '../../../middleware/api/authenticationMiddleware';
import { NextApiRequest, NextApiResponse } from 'next';

export default withHttpMethods({
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const imageUrl = req.query.url;

      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(400).json({ error: 'Fehler beim Abrufen des Bildes' });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      if (contentType.startsWith('image')) {
        const buffer = await response.arrayBuffer();
        res.write(Buffer.from(buffer));
        res.end();
      } else {
        res.status(400).json({ error: 'URL ist keine Bilddatei' });
      }
    } catch (error) {
      console.error('Fehler beim Laden des Bildes:', error);
      res.status(500).json({ error: 'Interner Serverfehler' });
    }
  }),
});
