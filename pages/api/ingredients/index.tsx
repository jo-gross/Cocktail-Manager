// pages/api/post/index.ts

import prisma from '../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import IngredientCreateInput = Prisma.IngredientCreateInput;

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const ingredients = await prisma.ingredient.findMany();
    return res.json(ingredients);
  }

  const { name, price, volume, unit, id, shortName, link, tags, image } = req.body;

  const input: IngredientCreateInput = {
    id: id,
    name: name,
    volume: volume,
    shortName: shortName,
    unit: unit,
    price: price,
    link: link,
    tags: tags,
    image: image,
  };
  if (req.method === 'PUT') {
    const result = await prisma.ingredient.update({
      where: {
        id: id,
      },
      data: input,
    });
    return res.json(result);
  } else if (req.method === 'POST') {
    const result = await prisma.ingredient.create({
      data: input,
    });
    return res.json(result);
  }
}
