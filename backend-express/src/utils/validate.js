// Request validation with zod. Every route parses its input explicitly:
//
//   const dto = parse(createTaskSchema, req.body);
//
// Schemas are "strict", so unknown fields are rejected (400) instead of silently ignored -
// the same rule the NestJS version enforced with `forbidNonWhitelisted`.
import { z } from 'zod';
import { badRequest } from './httpError.js';

export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const messages = result.error.issues.map((issue) =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    );
    throw badRequest(messages);
  }
  return result.data;
}

// ---------- Reusable field types ----------

export const uuid = z.guid();
export const nonEmptyString = z.string().min(1);

// A date string like "2026-09-28" or "2026-09-28T10:00:00.000Z", converted to a Date.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'must be an ISO date string')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid date')
  .transform((value) => new Date(value));

// Query-string values always arrive as strings: "true" / "false" -> boolean.
export const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

// ?page=1&pageSize=20&cursor=<id>
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.guid().optional(),
};

// Prisma enums (same values as schema.prisma).
export const RoleName = z.enum(['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN', 'SYSTEM_ADMIN']);
export const UserStatus = z.enum(['ACTIVE', 'SUSPENDED', 'INVITED']);
export const OrganizationStatus = z.enum(['ACTIVE', 'SUSPENDED']);
export const ProjectStatus = z.enum(['PLANNING', 'ACTIVE', 'AT_RISK', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);
export const TaskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const TaskStatusCategory = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
export const DependencyType = z.enum(['BLOCKS', 'RELATES_TO']);
export const ProjectMemberRole = z.enum(['MANAGER', 'CONTRIBUTOR', 'VIEWER']);
