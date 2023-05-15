// pages/api/post/index.ts

import prisma from "../../../lib/prisma";
import { Prisma } from ".prisma/client";
import DecorationCreateInput = Prisma.DecorationCreateInput;

export default async function handle(req, res) {
  const { name, price, id, image } = req.body;

  const input: DecorationCreateInput = {
    id: id,
    name: name,
    price: price,
    image: image
  };
  if (req.method === "PUT") {
    const result = await prisma.decoration.update({
      where: {
        id: id
      },
      data: input
    });
    return res.json(result);
  } else if (req.method === "POST") {
    const result = await prisma.decoration.create({
      data: input
    });
    return res.json(result);
  }
}
