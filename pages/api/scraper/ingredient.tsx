// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';

// @ts-ignore
import JSSoup from 'jssoup';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { User } from '@generated/prisma';

interface ResponseBody {
  name: string;
  image?: string;
  price: number;
  volume: number;
}

export default withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
  if (req.method === 'GET') {
    console.log(`User '${user.id}' requested scraping for URL: ${req.query.url}`);
    if (req.query?.url?.includes('conalco.de')) {
      console.debug(req.query.url);
      const response = await fetch(req.query.url as string);
      console.debug(response.status + ' ' + response.statusText);

      const body = await response.text();
      const soup = new JSSoup(body);

      const imageTag = soup.find('div', { class: 'cms-element-image-gallery' })?.find('img');
      const imageUrl = imageTag?.attrs?.src;

      const imageResponse = await fetch(imageUrl).catch((error) => {
        console.log(error);
        return undefined;
      });

      const image = imageResponse != undefined ? 'data:image/jpg;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64') : undefined;
      const name = soup.find('h1', 'product-detail-name')?.text?.replace('\n', '')?.trim() ?? '';
      const price = soup.find('meta', { itemprop: 'price' })?.attrs?.content ?? 0;
      const volume = (soup.find('span', 'price-unit-content')?.text?.trim()?.split(' ')?.[0] ?? 0) * 100;

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

      const puppeteer = require('puppeteer-core');
      const chromiumHost = process.env.CHROMIUM_HOST;

      let browser;
      if (chromiumHost && chromiumHost !== 'localhost' && chromiumHost !== '127.0.0.1') {
        // Connect to remote Chromium service using DNS lookup
        console.log('Fetching WebSocket URL from Chromium...');
        const dns = require('dns').promises;

        try {
          const { address: chromeIP } = await dns.lookup(chromiumHost);
          console.log('Chromium IP:', chromeIP);

          browser = await puppeteer.connect({
            browserURL: `http://${chromeIP}:9222`,
          });
        } catch (dnsError) {
          console.error('DNS lookup failed, trying hostname directly:', dnsError);
          // Fallback: try with hostname directly
          browser = await puppeteer.connect({
            browserURL: `http://${chromiumHost}:9222`,
          });
        }
      } else if (chromiumHost === 'localhost' || chromiumHost === '127.0.0.1') {
        // Connect to localhost Chromium
        browser = await puppeteer.connect({
          browserURL: 'http://localhost:9222',
        });
      } else {
        browser = await puppeteer.launch();
      }

      const page = await browser.newPage();
      await page.goto(req.query.url as string, { waitUntil: 'networkidle0' });

      const imageUrl = await page.$eval('#mainImage', (el: Element) => (el as HTMLImageElement).src).catch(() => null);
      const name = (await page.$eval('div.mfcss_article-detail--title > h2 > span', (el: Element) => el.textContent || '').catch(() => '')) ?? '';
      const priceText = await page
        .$$eval(
          'div.mfcss_article-detail--price-container > div.row > div.text-right > div > span.mfcss_article-detail--price-breakdown > span > span',
          (elements: Element[]) => elements.map((el) => el.textContent || ''),
        )
        .catch(() => []);

      const price = priceText?.[1]?.replace(',', '.')?.replace('€', '')?.trim() ?? 0;

      await page.close();
      await browser.disconnect();

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
});
