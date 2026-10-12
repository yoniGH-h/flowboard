// נתיבי מרכז ההחלטות.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { isoDate, parse, uuid } from '../../utils/validate.js';
import * as planning from './planning.service.js';

// שינויי ה"מה אם" (ראו applyChanges בקובץ model.js).
const changesSchema = z.strictObject({
    reassign: z.array(z.strictObject({ taskId: uuid, toUserId: uuid })).max(20).optional(),
    deferTaskIds: z.array(uuid).max(20).optional(),
    addMemberIds: z.array(uuid).max(5).optional(),
    unblockTaskIds: z.array(uuid).max(20).optional(),
    newTargetDate: isoDate.optional(),
  })
  .refine(
    (c) => c.reassign?.length || c.deferTaskIds?.length || c.addMemberIds?.length || c.unblockTaskIds?.length || c.newTargetDate,
    'Choose at least one change',
  );

const simulateSchema = z.strictObject({ changes: changesSchema });
const decisionSchema = z.strictObject({
  changes: changesSchema,
  source: z.enum(['SIMULATOR', 'RECOMMENDATION']),
  note: z.string().max(500).optional(),
});
const noteSchema = z.strictObject({ note: z.string().max(500) });

// מרכז ההחלטות. דורש reports.view; בכל פרויקט נדרש בנוסף tasks.manage
// (נבדק ב-service - מנהל פרויקט יכול לתכנן רק את הפרויקטים שלו).
// הראוטר של מרכז ההחלטות.
// נקרא מ: app.js
export const planningRouter = Router();
planningRouter.use(requirePermission('reports.view'));

// מחזיר את תמונת המצב של הפרויקט למסך התכנון.
// נקרא מ: fetchPlanningView (api.js)
// קורא ל: planning.getPlanningView
planningRouter.get('/projects/:projectId', async (req, res) => {
  res.json(await planning.getPlanningView(req.user, req.params.projectId));
});

// "מה אם": שום דבר לא נשמר.
// מחשב "לפני ואחרי" לשינויים מוצעים, בלי לשמור.
// נקרא מ: simulatePlan (api.js)
// קורא ל: parse, planning.simulate
planningRouter.post('/projects/:projectId/simulate', async (req, res) => {
  const { changes } = parse(simulateSchema, req.body);
  res.json(await planning.simulate(req.user, req.params.projectId, changes));
});

// מציע פעולות לשיפור, כל אחת עם ההשפעה החזויה שלה.
// נקרא מ: fetchRecommendations (api.js)
// קורא ל: planning.recommend
planningRouter.get('/projects/:projectId/recommendations', async (req, res) => {
  res.json(await planning.recommend(req.user, req.params.projectId));
});

// מבצע את השינויים בפועל ורושם את ההחלטה.
// מבצע החלטה בפועל בתוך טרנזקציה אחת, ורושם אותה.
// נקרא מ: applyDecision (api.js)
// קורא ל: parse, planning.applyDecision
planningRouter.post('/projects/:projectId/decisions', async (req, res) => {
  const dto = parse(decisionSchema, req.body);
  res.status(201).json(await planning.applyDecision(req.user, req.params.projectId, dto));
});

// שולף את ההחלטות שבוצעו ומה קרה מאז.
// נקרא מ: fetchDecisions (api.js)
// קורא ל: parse, planning.listDecisions
planningRouter.get('/decisions', async (req, res) => {
  const { projectId } = parse(z.strictObject({ projectId: uuid.optional() }), req.query);
  res.json(await planning.listDecisions(req.user, projectId));
});

// מעדכן את ההערה של החלטה.
// נקרא מ: אין קריאה מהאתר
// קורא ל: parse, planning.updateDecisionNote
planningRouter.patch('/decisions/:id', async (req, res) => {
  const { note } = parse(noteSchema, req.body);
  res.json(await planning.updateDecisionNote(req.user, req.params.id, note));
});
