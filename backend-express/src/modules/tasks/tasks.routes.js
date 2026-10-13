// נתיבי המשימות.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import {
  DependencyType,
  isoDate,
  nonEmptyString,
  paginationShape,
  parse,
  queryBoolean,
  TaskPriority,
  TaskStatusCategory,
  uuid,
} from '../../utils/validate.js';
import * as reports from './tasks.reports.js';
import * as tasksService from './tasks.service.js';

// ---------- בדיקת קלט ----------

const labelIds = z
  .array(uuid)
  .refine((ids) => new Set(ids).size === ids.length, 'labelIds must not contain duplicates');

const createTaskSchema = z.strictObject({
  parentTaskId: uuid.optional(),
  projectId: uuid,
  columnId: uuid,
  title: nonEmptyString,
  description: z.string().optional(),
  assigneeId: uuid.optional(),
  priority: TaskPriority.optional(),
  startDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  estimatedHours: z.number().optional(),
  labelIds: labelIds.optional(),
});

const updateTaskSchema = z.strictObject({
  title: nonEmptyString.optional(),
  description: z.string().optional(),
  priority: TaskPriority.optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  blocked: z.boolean().optional(),
  labelIds: labelIds.optional(),
});

const queryTasksSchema = z.strictObject({
  ...paginationShape,
  projectId: uuid.optional(),
  assigneeId: z.string().optional(), // מזהה משתמש, או "me"
  status: TaskStatusCategory.optional(),
  priority: TaskPriority.optional(),
  overdue: queryBoolean.optional(),
  blocked: queryBoolean.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'updatedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const projectFilterSchema = z.strictObject({ projectId: uuid.optional() });

const queryReportsSchema = z.strictObject({
  projectId: uuid.optional(),
  assigneeId: z.string().optional(),
  days: z.coerce.number().int().min(0).optional(),
});

const moveSchema = z.strictObject({ columnId: uuid });
const assignSchema = z.strictObject({ assigneeId: uuid.nullable().optional() });
const archiveSchema = z.strictObject({ archived: z.boolean() });
const addDependencySchema = z.strictObject({
  dependsOnTaskId: uuid,
  type: DependencyType.optional(),
});

// ---------- נתיבים ----------

// הראוטר של המשימות.
export const tasksRouter = Router();
const canViewReports = requirePermission('reports.view');

// יוצר משימה אחרי בדיקת הרשאה, עמודה ואחראי.
tasksRouter.post('/', async (req, res) => {
  res.status(201).json(await tasksService.create(req.user, parse(createTaskSchema, req.body)));
});

// שולף משימות לפי סינון.
tasksRouter.get('/', async (req, res) => {
  res.json(await tasksService.findAll(req.user, parse(queryTasksSchema, req.query)));
});

// מחשב לכל עובד משימות פתוחות, איחורים ושעות.
tasksRouter.get('/workload-summary', canViewReports, async (req, res) => {
  const { projectId } = parse(projectFilterSchema, req.query);
  res.json(await reports.getWorkloadSummary(req.user, projectId));
});

// מחשב את נתוני הדשבורד הניהולי, כולל גרף ההתקדמות.
tasksRouter.get('/dashboard-summary', canViewReports, async (req, res) => {
  const { projectId } = parse(projectFilterSchema, req.query);
  res.json(await reports.getDashboardSummary(req.user, projectId));
});

// מחשב את נתוני מסך הדוחות לפי הסינון.
tasksRouter.get('/reports-summary', canViewReports, async (req, res) => {
  res.json(await reports.getReportsSummary(req.user, parse(queryReportsSchema, req.query)));
});

// שולף משימה אחת עם כל הפרטים.
tasksRouter.get('/:id', async (req, res) => {
  res.json(await tasksService.findOne(req.user, req.params.id));
});

// שולף את היסטוריית הפעילות של משימה.
tasksRouter.get('/:id/activity', async (req, res) => {
  res.json(await tasksService.getActivity(req.user, req.params.id));
});

// מוסיף תלות בין שתי משימות.
tasksRouter.post('/:id/dependencies', async (req, res) => {
  const dto = parse(addDependencySchema, req.body);
  res.status(201).json(await tasksService.addDependency(req.user, req.params.id, dto));
});

// מסיר תלות בין משימות.
tasksRouter.delete('/:id/dependencies/:dependsOnTaskId', async (req, res) => {
  res.json(await tasksService.removeDependency(req.user, req.params.id, req.params.dependsOnTaskId));
});

// מעדכן את שדות המשימה.
tasksRouter.patch('/:id', async (req, res) => {
  res.json(await tasksService.update(req.user, req.params.id, parse(updateTaskSchema, req.body)));
});

// מעביר משימה לעמודה: הרשאה, מגבלת WIP, חסימות, התראה ואוטומציה.
tasksRouter.patch('/:id/move', async (req, res) => {
  res.json(await tasksService.move(req.user, req.params.id, parse(moveSchema, req.body)));
});

// משייך משימה לעובד ושולח לו התראה.
tasksRouter.patch('/:id/assign', async (req, res) => {
  const { assigneeId } = parse(assignSchema, req.body);
  res.json(await tasksService.assign(req.user, req.params.id, assigneeId));
});

// מעביר משימה לארכיון או מחזיר ממנו.
tasksRouter.patch('/:id/archive', async (req, res) => {
  const { archived } = parse(archiveSchema, req.body);
  res.json(await tasksService.setArchived(req.user, req.params.id, archived));
});

// מוחק משימה.
tasksRouter.delete('/:id', async (req, res) => {
  await tasksService.remove(req.user, req.params.id);
  res.status(204).end();
});
