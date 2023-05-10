import prisma from "../../../lib/prisma";


// DELETE /api/decoration/:id

export default async function handle(req, res) {
  const id = req.query.id;
  if (req.method === "DELETE") {
    const result = await prisma.decoration.delete({
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
