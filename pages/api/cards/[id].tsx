import prisma from "../../../lib/prisma";


// DELETE /api/cocktails/:id

export default async function handle(req, res) {
  const id = req.query.id;
  if (req.method === "GET") {
    const result = await prisma.cocktailCard.findFirst({
        where: {
          id: id
        },
        include: {
          groups: {
            include: {
              items: {
                include: {
                  cocktail: {
                    include: {
                      glass: true,
                      decoration: true,
                      steps: {
                        include: {
                          ingredients: {
                            include: {
                              ingredient: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    );
    return res.json(result);
  } else {
    throw new Error(
      `The HTTP ${req.method} method is not supported at this route.`
    );
  }
}
