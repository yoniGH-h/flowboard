import { Router } from 'express';
import { prisma } from '../../db.js';

export const labelsRouter = Router();

labelsRouter.get('/', async (req, res) => {
  res.json(
    await prisma.label.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { name: 'asc' },
    }),
  );
});
