// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
// @ts-ignore
import JSSoup from 'jssoup';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (req.query?.url?.includes('conalco.de')) {
      const response = await fetch(req.query.url as string);
      const body = await response.text();
      const soup = new JSSoup(body);
      const imageResponse = await fetch(soup.find('div', 'product--image-container').contents[0].find('img').attrs.src);
      const image = 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64');
      const name = soup.find('h1', 'product--title').text.replace('\n', '').trim();
      const price = soup.find('meta', { itemprop: 'price' }).attrs.content;

      const volume =
        Number(
          soup
            .find('div', 'conheadtabel')
            .contents[0].contents[1].contents[1].contents[1].text.replace('\n', '')
            .replace(',', '.')
            .split(' ')[0]
            .trim(),
        ) * 100;

      return res.json({
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      });
    }
  }
  return res.status(404).json({ message: 'URL not allowed' });
}
