// Effective permissions = what a user is actually allowed to do, built in three layers:
//
//   1. role defaults            (catalog.js ROLE_DEFAULTS - union of every role the user holds)
//   2. organization changes     (OrganizationRolePermission: "in our org, Employees may also X")
//   3. personal exceptions      (UserPermissionOverride: "Dana may also X" / "Yossi may not Y")
//
// Later layers win. Expired exceptions are ignored. 'system' permissions (platform-wide)
// only ever come from the SYSTEM_ADMIN role - no organization can grant or remove them.
import { prisma } from '../db.js';
import { EDITABLE_ROLES, PERMISSIONS, ROLE_DEFAULTS } from './catalog.js';

// Loads everything needed to compute one user's permissions (2 small queries).
export async function loadPermissionInputs(organizationId, userId) {
  const [orgChanges, userOverrides] = await Promise.all([
    prisma.organizationRolePermission.findMany({ where: { organizationId } }),
    prisma.userPermissionOverride.findMany({ where: { userId } }),
  ]);
  return { orgChanges, userOverrides };
}

const isActive = (override, now) => !override.expiresAt || override.expiresAt > now;

// Does this role have this permission in this organization (layers 1 + 2)?
// Returns { granted, source: 'role' | 'organization' }.
export function roleHasPermission(roleName, key, orgChanges) {
  const change = EDITABLE_ROLES.includes(roleName)
    ? orgChanges.find((c) => c.roleName === roleName && c.permissionKey === key)
    : undefined;
  if (change) return { granted: change.granted, source: 'organization' };
  return { granted: ROLE_DEFAULTS[roleName]?.includes(key) ?? false, source: 'role' };
}

// The full explanation for every permission in the catalog - used by the permissions
// screen ("why can Dana do this?"). Each entry: { key, granted, source, expiresAt?, reason? }
//   source: 'role' | 'organization' | 'user'
export function explainPermissions(roles, { orgChanges, userOverrides }, now = new Date()) {
  return PERMISSIONS.map(({ key, scope }) => {
    // Layers 1 + 2: granted if ANY of the user's roles has it.
    const perRole = roles.map((role) => roleHasPermission(role, key, orgChanges));
    const fromRole = perRole.find((r) => r.granted);
    let result = fromRole
      ? { key, granted: true, source: fromRole.source }
      : { key, granted: false, source: perRole.some((r) => r.source === 'organization') ? 'organization' : 'role' };

    // Layer 3: a personal exception (never for platform-level permissions).
    const override = scope === 'system' ? undefined : userOverrides.find((o) => o.permissionKey === key);
    if (override && isActive(override, now)) {
      result = {
        key,
        granted: override.granted,
        source: 'user',
        expiresAt: override.expiresAt,
        reason: override.reason,
        roleGranted: Boolean(fromRole), // what the user would have without the exception
      };
    }
    return result;
  });
}

// Just the set of permission keys the user has - what every request is checked against.
export function effectivePermissions(roles, inputs, now = new Date()) {
  return new Set(
    explainPermissions(roles, inputs, now)
      .filter((p) => p.granted)
      .map((p) => p.key),
  );
}
