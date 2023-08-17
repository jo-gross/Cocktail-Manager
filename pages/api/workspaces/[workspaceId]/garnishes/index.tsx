// pages/api/post/index.ts

import prisma from '../../../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import GarnishCreateInput = Prisma.GarnishCreateInput;

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });

  if (req.method === 'GET') {
    const garnishes = await prisma.garnish.findMany({
      where: {
        workspaceId: workspaceId,
      },
    });
    return res.json(garnishes);
  }

  const { name, price, id, image, description } = req.body;

  const input: GarnishCreateInput = {
    id: id,
    name: name,
    price: price,
    image: image,
    description: description,
    workspace: {
      connect: {
        id: workspaceId,
      },
    },
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
