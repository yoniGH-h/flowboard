import { Router } from 'express';
import { prisma } from '../../db.js';
import { requirePermission } from '../../middleware/auth.js';

export const rolesRouter = Router();

// The four fixed roles and their permissions (read-only; drives the Roles & Permissions screen).
rolesRouter.get('/', requirePermission('permissions.manage'), async (_req, res) => {
  res.json(
    await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    }),
  );
});
