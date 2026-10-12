// נתיב רשימת התפקידים.

import { Router } from 'express';
import { prisma } from '../../db.js';
import { requirePermission } from '../../middleware/auth.js';

// הראוטר של התפקידים.
// נקרא מ: app.js
export const rolesRouter = Router();

// ארבעת התפקידים הקבועים וההרשאות שלהם (לקריאה בלבד; משמש את מסך התפקידים וההרשאות).
rolesRouter.get('/', requirePermission('permissions.manage'), async (_req, res) => {
  res.json(
    await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    }),
  );
});
