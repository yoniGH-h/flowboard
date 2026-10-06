ALTER TABLE "users"
  ADD COLUMN "defaultRole" "RoleName" NOT NULL DEFAULT 'EMPLOYEE',
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "tasks" ADD COLUMN "parentTaskId" TEXT;
CREATE INDEX "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey"
  FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "automation_rule_executions" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "taskId" TEXT,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_rule_executions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "automation_rule_executions_ruleId_createdAt_idx"
  ON "automation_rule_executions"("ruleId", "createdAt");
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "users" u
SET "defaultRole" = COALESCE(
  (SELECT ur_role.name
   FROM "user_roles" ur
   JOIN "roles" ur_role ON ur_role.id = ur."roleId"
   WHERE ur."userId" = u.id
   ORDER BY CASE ur_role.name
     WHEN 'SYSTEM_ADMIN' THEN 4 WHEN 'ORG_ADMIN' THEN 3
     WHEN 'PROJECT_MANAGER' THEN 2 ELSE 1 END DESC
   LIMIT 1),
  'EMPLOYEE'::"RoleName"
);
