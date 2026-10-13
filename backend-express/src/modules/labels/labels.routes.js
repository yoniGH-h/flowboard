// נתיב התוויות.

import { Router } from 'express';
import { prisma } from '../../db.js';

// הראוטר של התוויות.
export const labelsRouter = Router();

// מחזיר את התוויות של הארגון.
labelsRouter.get('/', async (req, res) => {
  res.json(
    await prisma.label.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { name: 'asc' },
    }),
  );
});
