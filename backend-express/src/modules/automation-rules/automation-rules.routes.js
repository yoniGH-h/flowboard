// תפקיד הקובץ: נתיבי חוקי האוטומציה: ניהול החוקים, היסטוריה והרצה ידנית.
// משתמשים בו: app.js

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { nonEmptyString, parse, uuid } from '../../utils/validate.js';
import * as rulesService from './automation-rules.service.js';

// trigger / condition / action all share this shape.
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

// Same fields, all optional. projectId: null means "all projects".
const updateRuleSchema = createRuleSchema.partial();

const toggleSchema = z.strictObject({ enabled: z.boolean() });

// ---------- Routes (automation.manage - Org Admins by default) ----------

// הראוטר של חוקי האוטומציה.
// נקרא מ: app.js
export const automationRulesRouter = Router();
automationRulesRouter.use(requirePermission('automation.manage'));

automationRulesRouter.get('/', async (req, res) => {
  res.json(await rulesService.findForOrganization(req.user.organizationId));
});

automationRulesRouter.post('/', async (req, res) => {
  res.status(201).json(await rulesService.create(req.user, parse(createRuleSchema, req.body)));
});

// Runs the scan triggers (overdue / due soon) right now for the caller's organization,
// instead of waiting for the next 15-minute scan.
automationRulesRouter.post('/run-now', async (req, res) => {
  res.status(201).json(await rulesService.runScans(req.user.organizationId));
});

automationRulesRouter.patch('/:id', async (req, res) => {
  res.json(await rulesService.update(req.user, req.params.id, parse(updateRuleSchema, req.body)));
});

automationRulesRouter.delete('/:id', async (req, res) => {
  res.json(await rulesService.remove(req.user, req.params.id));
});

automationRulesRouter.get('/:id/executions', async (req, res) => {
  res.json(await rulesService.executions(req.user, req.params.id));
});

automationRulesRouter.patch('/:id/toggle', async (req, res) => {
  const { enabled } = parse(toggleSchema, req.body);
  res.json(await rulesService.toggle(req.user, req.params.id, enabled));
});
