// pages/api/post/index.ts

import prisma from "../../../lib/prisma";
import { Prisma } from ".prisma/client";
import GlassCreateInput = Prisma.GlassCreateInput;

export default async function handle(req, res) {
  const { name, id, image, deposit, volume } = req.body;
  const input: GlassCreateInput = {
    id: id,
    name: name,
    volume: volume,
    image: image,
    deposit: deposit
  };
  if (req.method === "PUT") {
    const result = await prisma.glass.update({
      where: {
        id: id
      },
      data: input
    });
    return res.json(result);
  } else if (req.method === "POST") {
    const result = await prisma.glass.create({
      data: input
    });
    return res.json(result);
  }
}
