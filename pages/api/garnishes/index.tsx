// pages/api/post/index.ts

import prisma from '../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import GarnishCreateInput = Prisma.GarnishCreateInput;

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const garnishes = await prisma.garnish.findMany();
    return res.json(garnishes);
  }

  const { name, price, id, image, description } = req.body;

  const input: GarnishCreateInput = {
    id: id,
    name: name,
    price: price,
    image: image,
    description: description,
  };
  if (req.method === 'PUT') {
    const result = await prisma.garnish.update({
      where: {
        id: id,
      },
      data: input,
    });
    return res.json(result);
  } else if (req.method === 'POST') {
    const result = await prisma.garnish.create({
      data: input,
    });
    return res.json(result);
  }
}
