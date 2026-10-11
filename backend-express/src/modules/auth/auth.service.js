// תפקיד הקובץ: לוגיקת ההתחברות: סיסמאות, אסימונים, נעילת חשבון ואיפוס סיסמה.
// משתמשים בו: auth.routes.js

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { badRequest, conflict, unauthorized } from '../../utils/httpError.js';
import { slugify } from '../../utils/slugify.js';
import { recordAudit } from '../audit-log/audit-log.service.js';

const PASSWORD_SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626'];

const randomAvatarColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// Sign up = create a brand-new organization with the caller as its first Org Admin.
// הרשמה: יוצר ארגון חדש ואת המשתמש הראשון שלו כמנהל הארגון.
// נקרא מ: auth.routes.js
export async function signUp(dto) {
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw conflict('An account with this email already exists');
  }

  // "Nimbus Digital" -> "nimbus-digital", then "nimbus-digital-2" if that is taken.
  const baseSlug = slugify(dto.organizationName) || 'organization';
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const [employeeRole, orgAdminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } }),
    prisma.role.findUniqueOrThrow({ where: { name: 'ORG_ADMIN' } }),
  ]);
  const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

  // Both rows or neither.
  const { user, organization } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: dto.organizationName, slug },
    });
    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        defaultRole: 'ORG_ADMIN',
        title: 'Organization Administrator',
        avatarColor: randomAvatarColor(),
        roles: {
          create: [
            { roleId: employeeRole.id, organizationId: organization.id },
            { roleId: orgAdminRole.id, organizationId: organization.id },
          ],
        },
      },
    });
    return { user, organization };
  });

  await recordAudit({
    organizationId: organization.id,
    actorId: user.id,
    action: 'ORGANIZATION_CREATED',
    entityType: 'Organization',
    entityId: organization.id,
  });
  await recordAudit({
    organizationId: organization.id,
    actorId: user.id,
    action: 'USER_SIGNED_UP',
    entityType: 'User',
    entityId: user.id,
  });

  return issueSession(user.id, user.email, organization.id, ['EMPLOYEE', 'ORG_ADMIN']);
}

// Join an existing organization (by its slug) as an Employee.
// הרשמה לארגון קיים כעובד.
// נקרא מ: auth.routes.js
export async function joinOrganization(dto) {
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw conflict('An account with this email already exists');
  }

  const organization = await prisma.organization.findUnique({ where: { slug: dto.organizationSlug } });
  if (!organization || organization.status !== 'ACTIVE') {
    throw badRequest('This organization is not available to join');
  }

  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
  const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      title: 'Team Member',
      avatarColor: randomAvatarColor(),
      roles: { create: [{ roleId: employeeRole.id, organizationId: organization.id }] },
    },
  });

  await recordAudit({
    organizationId: organization.id,
    actorId: user.id,
    action: 'USER_JOINED_ORGANIZATION',
    entityType: 'User',
    entityId: user.id,
  });

  return issueSession(user.id, user.email, organization.id, ['EMPLOYEE']);
}

// כניסה: בודק סיסמה, מטפל בנעילה ומנפיק אסימונים.
// נקרא מ: auth.routes.js
export async function signIn(dto) {
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    include: { roles: { include: { role: true } } },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw unauthorized('Account temporarily locked. Try again later');
  }

  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    // Lock the account for 15 minutes after 5 wrong passwords in a row.
    if (user) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCK_MS) : null,
        },
      });
    }
    // Same message whether the email exists or not, so it can't be used to discover accounts.
    throw unauthorized('Invalid email or password');
  }
  if (user.status !== 'ACTIVE') {
    throw unauthorized('This account is not active');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'USER_SIGNED_IN',
    entityType: 'User',
    entityId: user.id,
  });

  return issueSession(
    user.id,
    user.email,
    user.organizationId,
    user.roles.map((r) => r.role.name),
  );
}

// Refresh-token rotation: a refresh token works exactly once. Using it revokes it and issues
// a brand-new pair, so a stolen-and-replayed token is rejected.
// מחליף אסימון רענון תקף בזוג אסימונים חדש.
// נקרא מ: auth.routes.js
export async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw unauthorized('Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw unauthorized('Invalid or expired refresh token');
  }
  if (!(await bcrypt.compare(refreshToken, stored.tokenHash))) {
    throw unauthorized('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { roles: { include: { role: true } } },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw unauthorized('Account is no longer active');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  return issueSession(
    user.id,
    user.email,
    user.organizationId,
    user.roles.map((r) => r.role.name),
  );
}

// יציאה: מבטל את אסימון הרענון.
// נקרא מ: auth.routes.js
export async function logout(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Already invalid/expired - logging out is idempotent either way.
  }
}

// The current password must match. Wrong current password = 400 (not 401, which would make
// the frontend try to refresh the session).
// שינוי סיסמה למשתמש מחובר, וביטול שאר החיבורים שלו.
// נקרא מ: auth.routes.js
export async function changePassword(actor, dto) {
  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }
  if (dto.currentPassword === dto.newPassword) {
    throw badRequest('The new password must be different from the current one');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS) },
  });
  await revokeAllSessions(user.id);
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user.id,
  });

  return issueSession(user.id, user.email, user.organizationId, actor.roles);
}

// מבטל את כל אסימוני הרענון של משתמש.
// נקרא מ: auth.routes.js
export async function revokeAllSessions(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Dev-only: there is no email provider, so the reset token is returned in the response
// instead of being emailed (see docs/security.md).
// יוצר אסימון חד-פעמי לאיפוס סיסמה.
// נקרא מ: auth.routes.js
export async function forgotPassword(dto) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) {
    return {}; // Do not reveal whether the email exists.
  }

  const rawToken = randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: await bcrypt.hash(rawToken, PASSWORD_SALT_ROUNDS),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  await revokeAllSessions(user.id);

  return { resetToken: `${user.id}.${rawToken}` };
}

// קובע סיסמה חדשה לפי אסימון האיפוס.
// נקרא מ: auth.routes.js
export async function resetPassword(dto) {
  const [userId, rawToken] = dto.token.split('.');
  if (!userId || !rawToken) {
    throw badRequest('Invalid reset token');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (
    !user ||
    !user.passwordResetTokenHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt < new Date() ||
    !(await bcrypt.compare(rawToken, user.passwordResetTokenHash))
  ) {
    throw badRequest('Invalid or expired reset token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: user.id,
  });
}

// Access token: short-lived (15m), sent as "Authorization: Bearer ...".
// Refresh token: long-lived (7d), stored only as a bcrypt hash so a database leak can't be
// replayed; its row id (jti) lets a single token be revoked.
async function issueSession(userId, email, organizationId, roles) {
  const accessToken = jwt.sign({ sub: userId, email, organizationId, roles }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  });

  const row = await prisma.refreshToken.create({
    data: { userId, tokenHash: 'pending', expiresAt: refreshExpiryDate() },
  });
  const refreshToken = jwt.sign({ sub: userId, jti: row.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  });
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { tokenHash: await bcrypt.hash(refreshToken, PASSWORD_SALT_ROUNDS) },
  });

  return { accessToken, refreshToken };
}

// "7d" -> a Date 7 days from now.
function refreshExpiryDate() {
  const match = /^(\d+)([smhd])$/.exec(config.jwt.refreshTtl);
  const amount = match ? Number(match[1]) : 7;
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + amount * unitMs[match ? match[2] : 'd']);
}
