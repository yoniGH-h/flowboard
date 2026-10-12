// נתיבי הפרויקטים.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import {
  isoDate,
  nonEmptyString,
  parse,
  ProjectMemberRole,
  ProjectStatus,
  TaskStatusCategory,
  uuid,
} from '../../utils/validate.js';
import * as projectsService from './projects.service.js';

// ---------- בדיקת קלט ----------

const createProjectSchema = z.strictObject({
  name: nonEmptyString,
  description: z.string(),
  managerId: uuid,
  startDate: isoDate,
  targetDate: isoDate,
  memberIds: z
    .array(uuid)
    .refine((ids) => new Set(ids).size === ids.length, 'memberIds must not contain duplicates')
    .optional(),
});

const updateProjectSchema = z.strictObject({
  name: nonEmptyString.optional(),
  description: z.string().optional(),
  status: ProjectStatus.optional(),
  managerId: uuid.optional(),
  startDate: isoDate.optional(),
  targetDate: isoDate.optional(),
});

const queryProjectsSchema = z.strictObject({
  scope: z.enum(['mine', 'all']).optional(),
  status: ProjectStatus.optional(),
  search: z.string().optional(),
  includeArchived: z.string().optional(),
});

const archiveSchema = z.strictObject({ archived: z.boolean() });

const addMemberSchema = z.strictObject({
  userId: uuid,
  roleOnProject: ProjectMemberRole.optional(),
});

const updateMemberSchema = z.strictObject({ roleOnProject: ProjectMemberRole });

const createColumnSchema = z.strictObject({
  name: nonEmptyString,
  category: TaskStatusCategory,
  wipLimit: z.number().int().min(1).optional(),
});

const updateColumnSchema = z.strictObject({
  name: nonEmptyString.optional(),
  order: z.number().int().min(0).optional(),
  wipLimit: z.number().int().min(1).nullable().optional(), // null = הסרת המגבלה
});

// ---------- נתיבים ----------

// כאן נבדקת רק יצירת פרויקט. כל פעולה אחרת תלויה באיזה פרויקט מדובר
// (מותר לך לנהל את הפרויקטים שלך אבל לא של מישהו אחר), ולכן ה-service בודק אותה לכל
// פרויקט עם assertProjectPermission.
// הראוטר של הפרויקטים.
// נקרא מ: app.js
export const projectsRouter = Router();

// יוצר פרויקט, עם לוח ועמודות ברירת מחדל.
// נקרא מ: createProject (api.js)
// קורא ל: requirePermission, projectsService.create, parse
projectsRouter.post('/', requirePermission('projects.create'), async (req, res) => {
  res.status(201).json(await projectsService.create(req.user, parse(createProjectSchema, req.body)));
});

// שולף את הפרויקטים שהמשתמש רשאי לראות.
// נקרא מ: fetchProjects (api.js)
// קורא ל: projectsService.findAll, parse
projectsRouter.get('/', async (req, res) => {
  res.json(await projectsService.findAll(req.user, parse(queryProjectsSchema, req.query)));
});

// שולף פרויקט אחד עם הפרטים והיכולות של המשתמש בו.
// נקרא מ: fetchProject (api.js)
// קורא ל: projectsService.findOne
projectsRouter.get('/:id', async (req, res) => {
  res.json(await projectsService.findOne(req.user, req.params.id));
});

// מעדכן את פרטי הפרויקט.
// נקרא מ: updateProject (api.js)
// קורא ל: projectsService.update, parse
projectsRouter.patch('/:id', async (req, res) => {
  res.json(await projectsService.update(req.user, req.params.id, parse(updateProjectSchema, req.body)));
});

// מעביר פרויקט לארכיון או מחזיר ממנו.
// נקרא מ: archiveProject (api.js)
// קורא ל: parse, projectsService.setArchived
projectsRouter.patch('/:id/archive', async (req, res) => {
  const { archived } = parse(archiveSchema, req.body);
  res.json(await projectsService.setArchived(req.user, req.params.id, archived));
});

// חברי צוות
// מוסיף חבר צוות לפרויקט.
// נקרא מ: addProjectMember (api.js)
// קורא ל: projectsService.addMember, parse
projectsRouter.post('/:id/members', async (req, res) => {
  res.status(201).json(await projectsService.addMember(req.user, req.params.id, parse(addMemberSchema, req.body)));
});

// משנה את התפקיד של חבר צוות בפרויקט.
// נקרא מ: אין קריאה מהאתר
// קורא ל: parse, projectsService.updateMember
projectsRouter.patch('/:id/members/:userId', async (req, res) => {
  const dto = parse(updateMemberSchema, req.body);
  res.json(await projectsService.updateMember(req.user, req.params.id, req.params.userId, dto));
});

// מסיר חבר צוות מהפרויקט.
// נקרא מ: removeProjectMember (api.js)
// קורא ל: projectsService.removeMember
projectsRouter.delete('/:id/members/:userId', async (req, res) => {
  res.json(await projectsService.removeMember(req.user, req.params.id, req.params.userId));
});

// קבצים ופעילות ברמת הפרויקט
// שולף את כל הקבצים של הפרויקט.
// נקרא מ: fetchProjectAttachments (api.js)
// קורא ל: projectsService.getAttachments
projectsRouter.get('/:id/attachments', async (req, res) => {
  res.json(await projectsService.getAttachments(req.user, req.params.id));
});

// שולף את הפעילות האחרונה בפרויקט.
// נקרא מ: fetchProjectActivity (api.js)
// קורא ל: projectsService.getActivity
projectsRouter.get('/:id/activity', async (req, res) => {
  res.json(await projectsService.getActivity(req.user, req.params.id));
});

// ציוני הסיכון היומיים (לגרף המגמה). ברירת המחדל ?days=30, ולכל היותר שנה.
// מחזיר את ציוני הסיכון היומיים של פרויקט.
// נקרא מ: fetchRiskHistory (api.js)
// קורא ל: parse, projectsService.getRiskHistory
projectsRouter.get('/:id/risk-history', async (req, res) => {
  const { days } = parse(z.strictObject({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query);
  res.json(await projectsService.getRiskHistory(req.user, req.params.id, days));
});

// לוח ה-Kanban והעמודות שלו
// שולף את הלוח: עמודות לפי הסדר והמשימות שבכל אחת.
// נקרא מ: fetchBoard (api.js)
// קורא ל: projectsService.getBoard
projectsRouter.get('/:id/board', async (req, res) => {
  res.json(await projectsService.getBoard(req.user, req.params.id));
});

// מוסיף עמודה ללוח.
// נקרא מ: addBoardColumn (api.js)
// קורא ל: projectsService.addColumn, parse
projectsRouter.post('/:id/board/columns', async (req, res) => {
  res.status(201).json(await projectsService.addColumn(req.user, req.params.id, parse(createColumnSchema, req.body)));
});

// מעדכן עמודה: שם, סדר או מגבלת WIP.
// נקרא מ: updateBoardColumn (api.js)
// קורא ל: parse, projectsService.updateColumn
projectsRouter.patch('/:id/board/columns/:columnId', async (req, res) => {
  const dto = parse(updateColumnSchema, req.body);
  res.json(await projectsService.updateColumn(req.user, req.params.id, req.params.columnId, dto));
});

// מוחק עמודה ריקה מהלוח.
// נקרא מ: deleteBoardColumn (api.js)
// קורא ל: projectsService.removeColumn
projectsRouter.delete('/:id/board/columns/:columnId', async (req, res) => {
  res.json(await projectsService.removeColumn(req.user, req.params.id, req.params.columnId));
});
