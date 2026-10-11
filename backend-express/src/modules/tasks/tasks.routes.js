// תפקיד הקובץ: נתיבי המשימות: יצירה, עדכון, הזזה, שיוך, תלויות ודוחות.
// משתמשים בו: app.js

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

// ---------- Validation ----------

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
  assigneeId: z.string().optional(), // a user id, or "me"
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

// ---------- Routes ----------

// Task actions are checked per project inside tasks.service.js (tasks.manage / tasks.create /
// tasks.move.own), because the same user may manage one project and only work in another.
// הראוטר של המשימות.
// נקרא מ: app.js
export const tasksRouter = Router();
const canViewReports = requirePermission('reports.view');

tasksRouter.post('/', async (req, res) => {
  res.status(201).json(await tasksService.create(req.user, parse(createTaskSchema, req.body)));
});

tasksRouter.get('/', async (req, res) => {
  res.json(await tasksService.findAll(req.user, parse(queryTasksSchema, req.query)));
});

// The summary routes are declared before '/:id', otherwise Express would treat
// "workload-summary" as a task id.
tasksRouter.get('/workload-summary', canViewReports, async (req, res) => {
  const { projectId } = parse(projectFilterSchema, req.query);
  res.json(await reports.getWorkloadSummary(req.user, projectId));
});

tasksRouter.get('/dashboard-summary', canViewReports, async (req, res) => {
  const { projectId } = parse(projectFilterSchema, req.query);
  res.json(await reports.getDashboardSummary(req.user, projectId));
});

tasksRouter.get('/reports-summary', canViewReports, async (req, res) => {
  res.json(await reports.getReportsSummary(req.user, parse(queryReportsSchema, req.query)));
});

tasksRouter.get('/:id', async (req, res) => {
  res.json(await tasksService.findOne(req.user, req.params.id));
});

tasksRouter.get('/:id/activity', async (req, res) => {
  res.json(await tasksService.getActivity(req.user, req.params.id));
});

tasksRouter.post('/:id/dependencies', async (req, res) => {
  const dto = parse(addDependencySchema, req.body);
  res.status(201).json(await tasksService.addDependency(req.user, req.params.id, dto));
});

tasksRouter.delete('/:id/dependencies/:dependsOnTaskId', async (req, res) => {
  res.json(await tasksService.removeDependency(req.user, req.params.id, req.params.dependsOnTaskId));
});

tasksRouter.patch('/:id', async (req, res) => {
  res.json(await tasksService.update(req.user, req.params.id, parse(updateTaskSchema, req.body)));
});

// Not PM-only: an Employee may move their own cards (checked inside the service).
tasksRouter.patch('/:id/move', async (req, res) => {
  res.json(await tasksService.move(req.user, req.params.id, parse(moveSchema, req.body)));
});

tasksRouter.patch('/:id/assign', async (req, res) => {
  const { assigneeId } = parse(assignSchema, req.body);
  res.json(await tasksService.assign(req.user, req.params.id, assigneeId));
});

tasksRouter.patch('/:id/archive', async (req, res) => {
  const { archived } = parse(archiveSchema, req.body);
  res.json(await tasksService.setArchived(req.user, req.params.id, archived));
});

tasksRouter.delete('/:id', async (req, res) => {
  await tasksService.remove(req.user, req.params.id);
  res.status(204).end();
});
