// תפקיד הקובץ: נתיב רשימת התוויות של הארגון.
// משתמשים בו: app.js

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
