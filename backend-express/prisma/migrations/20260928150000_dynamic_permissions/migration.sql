-- Dynamic permissions: per-organization changes to role permissions, and per-employee
-- permission exceptions (see src/permissions/catalog.js and effective.js).
-- CreateTable
CREATE TABLE "organization_role_permissions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleName" "RoleName" NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_role_permissions_organizationId_roleName_permi_key" ON "organization_role_permissions"("organizationId", "roleName", "permissionKey");

-- CreateIndex
CREATE INDEX "user_permission_overrides_organizationId_idx" ON "user_permission_overrides"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionKey_key" ON "user_permission_overrides"("userId", "permissionKey");

-- AddForeignKey
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

