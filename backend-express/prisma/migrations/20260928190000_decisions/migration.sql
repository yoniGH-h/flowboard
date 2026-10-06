-- Decision log: management decisions taken from the planning screen, with the risk / forecast
-- at that moment and the model's prediction, so their effect can be measured later.
-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "note" TEXT,
    "riskBefore" INTEGER NOT NULL,
    "riskPredicted" INTEGER NOT NULL,
    "daysLateBefore" INTEGER,
    "daysLatePredicted" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decisions_organizationId_idx" ON "decisions"("organizationId");

-- CreateIndex
CREATE INDEX "decisions_projectId_idx" ON "decisions"("projectId");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

