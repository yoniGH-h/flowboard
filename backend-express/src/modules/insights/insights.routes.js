// נתיב התובנות.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { parse, uuid } from '../../utils/validate.js';
import { getInsights } from './insights.service.js';

// הראוטר של התובנות.
export const insightsRouter = Router();

// מחזיר את התובנות לפרויקטים שהמשתמש מנהל.
insightsRouter.get('/', requirePermission('reports.view'), async (req, res) => {
  const { projectId } = parse(z.strictObject({ projectId: uuid.optional() }), req.query);
  res.json(await getInsights(req.user, projectId));
});
