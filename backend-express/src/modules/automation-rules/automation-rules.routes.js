// נתיבי חוקי האוטומציה.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { nonEmptyString, parse, uuid } from '../../utils/validate.js';
import * as rulesService from './automation-rules.service.js';

// ל-trigger, ל-condition ול-action יש אותו מבנה.
const tagSchema = z.strictObject({
  type: nonEmptyString,
  label: nonEmptyString,
  userId: uuid.optional(),
  columnId: uuid.optional(),
  days: z.number().int().min(1).max(30).optional(),
});

const createRuleSchema = z.strictObject({
  projectId: uuid.nullish(),
  name: nonEmptyString,
  enabled: z.boolean().optional(),
  trigger: tagSchema,
  condition: tagSchema.nullish(),
  action: tagSchema,
});

// אותם שדות, כולם אופציונליים. projectId: null פירושו "כל הפרויקטים".
const updateRuleSchema = createRuleSchema.partial();

const toggleSchema = z.strictObject({ enabled: z.boolean() });

// ---------- נתיבים (automation.manage - כברירת מחדל מנהלי ארגון) ----------

// הראוטר של חוקי האוטומציה.
export const automationRulesRouter = Router();
automationRulesRouter.use(requirePermission('automation.manage'));

// שולף את כל החוקים של הארגון.
automationRulesRouter.get('/', async (req, res) => {
  res.json(await rulesService.findForOrganization(req.user.organizationId));
});

// יוצר חוק חדש.
automationRulesRouter.post('/', async (req, res) => {
  res.status(201).json(await rulesService.create(req.user, parse(createRuleSchema, req.body)));
});

// סריקה תקופתית: חוקים של משימה באיחור ושל מועד מתקרב.
automationRulesRouter.post('/run-now', async (req, res) => {
  res.status(201).json(await rulesService.runScans(req.user.organizationId));
});

// מעדכן חוק קיים.
automationRulesRouter.patch('/:id', async (req, res) => {
  res.json(await rulesService.update(req.user, req.params.id, parse(updateRuleSchema, req.body)));
});

// מוחק חוק.
automationRulesRouter.delete('/:id', async (req, res) => {
  res.json(await rulesService.remove(req.user, req.params.id));
});

// שולף את היסטוריית ההרצות של חוק.
automationRulesRouter.get('/:id/executions', async (req, res) => {
  res.json(await rulesService.executions(req.user, req.params.id));
});

// מפעיל או מכבה חוק.
automationRulesRouter.patch('/:id/toggle', async (req, res) => {
  const { enabled } = parse(toggleSchema, req.body);
  res.json(await rulesService.toggle(req.user, req.params.id, enabled));
});
