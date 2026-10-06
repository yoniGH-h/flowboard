-- Insights: task column history (time spent in each stage) and daily project risk snapshots.
-- CreateTable
CREATE TABLE "task_status_changes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromColumnName" TEXT,
    "toColumnName" TEXT NOT NULL,
    "toCategory" "TaskStatusCategory" NOT NULL,
    "actorId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_risk_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,

    CONSTRAINT "project_risk_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_status_changes_taskId_changedAt_idx" ON "task_status_changes"("taskId", "changedAt");

-- CreateIndex
CREATE INDEX "task_status_changes_projectId_idx" ON "task_status_changes"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_risk_snapshots_projectId_day_key" ON "project_risk_snapshots"("projectId", "day");

-- AddForeignKey
ALTER TABLE "task_status_changes" ADD CONSTRAINT "task_status_changes_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_risk_snapshots" ADD CONSTRAINT "project_risk_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

