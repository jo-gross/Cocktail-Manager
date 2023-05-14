// pages/api/post/index.ts

import prisma from "../../../lib/prisma";
import { Prisma } from ".prisma/client";
import IngredientCreateInput = Prisma.IngredientCreateInput;

export default async function handle(req, res) {
  const { name, price, volume, unit, id, shortName, link } = req.body;

  const input: IngredientCreateInput = {
    id: id,
    name: name,
    volume: volume,
    shortName: shortName,
    unit: unit,
    price: price,
    link: link
  };
  if (req.method === "PUT") {
    const result = await prisma.ingredient.update({
      where: {
        id: id
      },
      data: input
    });
    return res.json(result);
  } else if (req.method === "POST") {
    const result = await prisma.ingredient.create({
      data: input
    });
    return res.json(result);
  }
}
