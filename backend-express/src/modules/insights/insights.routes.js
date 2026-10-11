// תפקיד הקובץ: נתיב התובנות של פרויקט.
// משתמשים בו: app.js

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { parse, uuid } from '../../utils/validate.js';
import { getInsights } from './insights.service.js';

// הראוטר של התובנות.
// נקרא מ: app.js
export const insightsRouter = Router();

// GET /api/insights?projectId= - צפי, דיוק הערכות, צווארי בקבוק, מגמת סיכון
// ומסקנות בשפה פשוטה, לפרויקטים שהמשתמש מנהל.
insightsRouter.get('/', requirePermission('reports.view'), async (req, res) => {
  const { projectId } = parse(z.strictObject({ projectId: uuid.optional() }), req.query);
  res.json(await getInsights(req.user, projectId));
});
