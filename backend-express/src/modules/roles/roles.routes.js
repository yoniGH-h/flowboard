// נתיב רשימת התפקידים.

import { Router } from 'express';
import { prisma } from '../../db.js';
import { requirePermission } from '../../middleware/auth.js';

// הראוטר של התפקידים.
export const rolesRouter = Router();

// מחזיר את התפקידים וההרשאות שלהם.
rolesRouter.get('/', requirePermission('permissions.manage'), async (_req, res) => {
  res.json(
    await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    }),
  );
});
