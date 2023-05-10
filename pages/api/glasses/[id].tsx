import prisma from "../../../lib/prisma";


// DELETE /api/glasses/:id

export default async function handle(req, res) {
  const id = req.query.id;
  if (req.method === "DELETE") {
    const result = await prisma.glass.delete({
      where: {
        id: id
      }
    });
    return res.json(result);
  } else {
    throw new Error(
      `The HTTP ${req.method} method is not supported at this route.`
    );
  }
}
