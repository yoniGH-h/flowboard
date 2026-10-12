// נתיב התוויות.

import { Router } from 'express';
import { prisma } from '../../db.js';

// הראוטר של התוויות.
// נקרא מ: app.js
export const labelsRouter = Router();

labelsRouter.get('/', async (req, res) => {
  res.json(
    await prisma.label.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { name: 'asc' },
    }),
  );
});
