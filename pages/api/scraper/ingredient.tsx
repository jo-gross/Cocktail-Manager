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
      console.log(req.query.url);
      const response = await fetch(req.query.url as string);
      console.log(response.status + ' ' + response.statusText);
      const body = await response.text();
      const soup = new JSSoup(body);

      const imageResponse = await fetch(
        soup.find('div', 'image-slider--container').contents[0].find('img').attrs.src,
      ).catch((error) => {
        console.log(error);
        return undefined;
      });

      const image =
        imageResponse != undefined
          ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
          : undefined;
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

      const result: ResponseBody = {
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      };

      return res.json(result);
    } else if (req.query?.url?.includes('expert24.com')) {
      console.log(req.query.url);
      const response = await fetch(req.query.url as string);
      console.log(response.status + ' ' + response.statusText);
      const body = await response.text();
      const soup = new JSSoup(body);

      const imageResponse = await fetch(soup.find('div', 'activeImage').contents[0].attrs.href).catch((error) => {
        console.log(error);
        return undefined;
      });

      const image =
        imageResponse != undefined
          ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
          : undefined;

      const name = soup.find('h1', 'item-detail__headline').text.replace('\n', '').trim();

      let price = soup
        .find('div', 'normalPrice')
        .contents[0].contents[0]._text.trim()
        .replace(',', '.')
        .replace('€', '')
        .trim();
      if (price == undefined) {
        price = 0;
      }
      const volume =
        Number(name.split('Vol. ')[1].split(' ')[0].replace(',', '.').replace('l', '').replace('ml', '')) * 100;

      return res.json({
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      });
    } else if (req.query?.url?.includes('metro.de')) {
      console.log(req.query.url);

      const playwright = require('playwright');
      const browser = await playwright['chromium'].launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(req.query.url);

      const imageUrl = await page.locator('#mainImage').first().getAttribute('src');
      const name = await page.locator('div.mfcss_article-detail--title > h2 > span').first().innerText();
      let price = await page
        .locator(
          'div.mfcss_article-detail--price-container > div.row > div.text-right > div > span.mfcss_article-detail--price-breakdown > span > span',
        )
        .allInnerTexts();
      price = price[1].replace(',', '.').replace('€', '').trim();

      await browser.close();

      const imageResponse = imageUrl
        ? await fetch(imageUrl).catch((error) => {
            console.log(error);
            return undefined;
          })
        : undefined;

      const image =
        imageResponse != undefined
          ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
          : undefined;

      if (price == undefined) {
        price = 0;
      }
      const volume = 0;
      // // Number(name.split('Vol. ')[1].split(' ')[0].replace(',', '.').replace('l', '').replace('ml', '')) * 100;
      //
      return res.json({
        name: name,
        image: image,
        price: Number(price),
        volume: Number(volume),
      });
    } else if (req.query?.url?.includes('rumundco.de')) {
      const response = await fetch(req.query.url as string);
      const body = await response.text();
      const soup = new JSSoup(body);

      const imageResponse = await fetch(soup.find('meta', { property: 'og:image' }).attrs.content).catch((error) => {
        console.log(error);
        return undefined;
      });

      const image =
        imageResponse != undefined
          ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
          : undefined;

      const name = soup.find('meta', { property: 'og:title' }).attrs.content;
      const price = soup.find('meta', { itemprop: 'price' }).attrs.content;

      const volume =
        Number(
          soup.find('span', 'price-unit-content').text.replace('\n', '').replace(',', '.').trim().split(' ')[0].trim(),
        ) * 100;

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
