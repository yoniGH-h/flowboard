import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { parse, uuid } from '../../utils/validate.js';
import { getInsights } from './insights.service.js';

export const insightsRouter = Router();

// GET /api/insights?projectId= - forecast, estimate accuracy, bottlenecks, risk trend and
// plain-language conclusions for the projects the caller manages.
insightsRouter.get('/', requirePermission('reports.view'), async (req, res) => {
  const { projectId } = parse(z.strictObject({ projectId: uuid.optional() }), req.query);
  res.json(await getInsights(req.user, projectId));
});
