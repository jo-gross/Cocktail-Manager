// pages/api/post/index.ts

import prisma from '../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import DecorationCreateInput = Prisma.DecorationCreateInput;

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const decorations = await prisma.decoration.findMany();
    return res.json(decorations);
  }

  const { name, price, id, image } = req.body;

  const input: DecorationCreateInput = {
    id: id,
    name: name,
    price: price,
    image: image,
  };
  if (req.method === 'PUT') {
    const result = await prisma.decoration.update({
      where: {
        id: id,
      },
      data: input,
    });
    return res.json(result);
  } else if (req.method === 'POST') {
    const result = await prisma.decoration.create({
      data: input,
    });
    return res.json(result);
  }
}
