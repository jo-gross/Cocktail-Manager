// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';

// @ts-ignore
import JSSoup from 'jssoup';

interface ResponseBody {
  name: string;
  image?: string;
  price: number;
  volume: number;
}

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (req.query?.url?.includes('conalco.de')) {
      console.debug(req.query.url);
      const response = await fetch(req.query.url as string);
      console.debug(response.status + ' ' + response.statusText);

      const body = await response.text();
      const soup = new JSSoup(body);

      const imageResponse = await fetch(soup.find('div', 'image-slider--container').contents[0].find('img').attrs.src).catch((error) => {
        console.log(error);
        return undefined;
      });

      const image = imageResponse != undefined ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64') : undefined;
      const name = soup.find('h1', 'product--title')?.text?.replace('\n', '')?.trim() ?? '';
      const price = soup.find('meta', { itemprop: 'price' })?.attrs?.content ?? 0;
      const volume = (soup.find('div', ['product--price', 'price--unit'])?.contents?.[1]?.['_text']?.split(' ')?.[0] ?? 0) * 1000;

      const result: ResponseBody = {
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      };

      return res.json(result);
    } else if (req.query?.url?.includes('expert24.com') || req.query?.url?.includes('delicando.com')) {
      console.debug(req.query.url);
      const response = await fetch(req.query.url as string);
      console.debug(response.status + ' ' + response.statusText);
      const body = await response.text();
      const soup = new JSSoup(body);

      console.debug(soup.find('div', 'activeImage'));

      const imageResponse = await fetch(soup.find('div', 'activeImage').contents[0].attrs.href).catch((error) => {
        console.error(error);
        return undefined;
      });

      const image = imageResponse != undefined ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64') : undefined;

      const name = soup.find('h1', 'item-detail__headline')?.text?.replace('\n', '')?.trim() ?? '';
      const price = soup.find('div', 'undiscountedPrice')?.contents?.[0]?._text?.trim()?.replace(',', '.')?.replace('€', '')?.trim() ?? 0;
      const volume = (name.split('Vol. ')?.[1]?.split(' ')?.[0]?.replace(',', '.')?.replace('l', '')?.replace('ml', '') ?? 0) * 100;

      return res.json({
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      });
    } else if (req.query?.url?.includes('metro.de')) {
      console.debug(req.query.url);

      const playwright = require('playwright');
      const browser = await playwright['chromium'].launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(req.query.url);

      const imageUrl = await page.locator('#mainImage').first().getAttribute('src');
      const name = (await page.locator('div.mfcss_article-detail--title > h2 > span')?.first()?.innerText()) ?? '';
      const price =
        (
          await page
            .locator('div.mfcss_article-detail--price-container > div.row > div.text-right > div > span.mfcss_article-detail--price-breakdown > span > span')
            ?.allInnerTexts()
        )?.[1]
          ?.replace(',', '.')
          ?.replace('€', '')
          ?.trim() ?? 0;

      await browser.close();

      const imageResponse = imageUrl
        ? await fetch(imageUrl).catch((error) => {
            return undefined;
          })
        : undefined;

      const image = imageResponse != undefined ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64') : undefined;

      const volume = 0;
      return res.json({
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      });
    } else if (req.query?.url?.includes('rumundco.de')) {
      console.debug(req.query.url);
      const response = await fetch(req.query.url as string);
      console.debug(response.status + ' ' + response.statusText);

      const body = await response.text();
      const soup = new JSSoup(body);

      const imageResponse = await fetch(soup.find('meta', { property: 'og:image' }).attrs.content).catch((error) => {
        console.error(error);
        return undefined;
      });

      const image = imageResponse != undefined ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64') : undefined;

      const name = soup.find('meta', { property: 'og:title' }).attrs.content;
      const price = soup.find('meta', { itemprop: 'price' }).attrs.content;

      const volume = Number(soup.find('span', 'price-unit-content').text.replace('\n', '').replace(',', '.').trim().split(' ')[0].trim()) * 100;

      const result: ResponseBody = {
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      };

      return res.json(result);
    }
  }

  return res.status(404).json({ message: 'URL not allowed' });
}
