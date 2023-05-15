// pages/api/post/index.ts

import prisma from "../../../lib/prisma";
import { Prisma } from ".prisma/client";
import CocktailCardCreateInput = Prisma.CocktailCardCreateInput;
import CocktailCardGroupItemCreateInput = Prisma.CocktailCardGroupItemCreateInput;

export default async function handle(req, res) {
  const {
    id,
    name,
    date,
    groups
  } = req.body;

  if (id != undefined) {
    await prisma.cocktailCardGroupItem.deleteMany({
      where: {
        cocktailCardGroup: {
          cocktailCard: {
            id: id
          }
        }
      }
    });

    await prisma.cocktailCardGroup.deleteMany({
      where: {
        cocktailCard: {
          id: id
        }
      }
    });
  }

  let cocktailCardResult;
  const input: CocktailCardCreateInput = {
    id: id,
    name: name,
    date: date
  };
  if (req.method === "PUT") {
    cocktailCardResult = await prisma.cocktailCard.update({
      where: {
        id: id
      },
      data: input
    });
  } else if (req.method === "POST") {
    cocktailCardResult = await prisma.cocktailCard.create({
      data: input
    });
  }

  if (groups.length > 0) {
    await groups.forEach(async (group) => {
      const groupResult = await prisma.cocktailCardGroup.create(
        {
          data: {
            id: group.id,
            name: group.name,
            groupNumber: group.groupNumber,
            groupPrice: group.groupPrice,
            cocktailCard: { connect: { id: cocktailCardResult.id } }
          }
        }
      );

      if (group.items.length > 0) {
        group.items.map(async (item) => {
          const input: CocktailCardGroupItemCreateInput = {
            cocktail: { connect: { id: item.cocktailId } },
            cocktailCardGroup: { connect: { id: groupResult.id } },
            itemNumber: item.itemNumber,
            specialPrice: item.specialPrice
          };
          await prisma.cocktailCardGroupItem.create({
            data: input
          });
        });
      }
    });
  }

  return res.json(cocktailCardResult);
}
