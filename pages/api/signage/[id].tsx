import { withHttpMethods } from '../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../lib/prisma';

export default withHttpMethods({
  [HTTPMethod.GET]: async (req, res) => {
    const { id } = req.query;
    const { format } = req.query;

    const signages = await prisma.signage.findMany({
      where: {
        workspaceId: id as string,
      },
    });
    if (format === undefined) return res.status(200).json({ content: signages });
    res.status(200).json({ content: signages.find((s) => s.format === format) ?? signages[0] });
  },
});
