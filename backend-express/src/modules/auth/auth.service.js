// לוגיקת ההתחברות.
// חלקים עיקריים: הרשמה, כניסה ונעילת חשבון, רענון ויציאה, שינוי ואיפוס סיסמה, הנפקת אסימונים.

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

// בוחר צבע אקראי לאווטאר.
// נקרא מ: signUp, joinOrganization
// קורא ל: —
const randomAvatarColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// הרשמה = יצירת ארגון חדש, כשהנרשם הוא מנהל הארגון הראשון שלו.
// הרשמה: יוצר ארגון חדש ואת המשתמש הראשון שלו כמנהל הארגון.
// נקרא מ: auth.routes.js
// קורא ל: conflict, slugify, randomAvatarColor, recordAudit, issueSession, מסד הנתונים (user, organization, role)
export async function signUp(dto) {
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw conflict('An account with this email already exists');
  }

  // "Nimbus Digital" -> "nimbus-digital", ואם תפוס אז "nimbus-digital-2".
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

  // שתי השורות או אף אחת.
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

// הצטרפות לארגון קיים (לפי ה-slug שלו) כעובד.
// הרשמה לארגון קיים כעובד.
// נקרא מ: auth.routes.js
// קורא ל: conflict, badRequest, randomAvatarColor, recordAudit, issueSession, מסד הנתונים (user, organization, role)
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
// קורא ל: unauthorized, recordAudit, issueSession, מסד הנתונים (user)
export async function signIn(dto) {
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    include: { roles: { include: { role: true } } },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw unauthorized('Account temporarily locked. Try again later');
  }

  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    // נועלים את החשבון ל-15 דקות אחרי 5 סיסמאות שגויות ברצף.
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
    // אותה הודעה בין אם האימייל קיים ובין אם לא, כדי שאי אפשר יהיה לגלות כך חשבונות.
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

// רוטציה של אסימון הרענון: אסימון רענון תקף לשימוש אחד בדיוק. השימוש מבטל אותו ומנפיק
// זוג חדש, כך שאסימון שנגנב ונשלח שוב נדחה.
// מחליף אסימון רענון תקף בזוג אסימונים חדש.
// נקרא מ: auth.routes.js
// קורא ל: unauthorized, issueSession, מסד הנתונים (refreshToken, user)
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
// קורא ל: מסד הנתונים (refreshToken)
export async function logout(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // כבר לא תקף או שפג - יציאה מצליחה בכל מקרה.
  }
}

// הסיסמה הנוכחית חייבת להתאים. סיסמה נוכחית שגויה = 400 (ולא 401, שהיה גורם
// לאתר לנסות לחדש את החיבור).
// שינוי סיסמה למשתמש מחובר, וביטול שאר החיבורים שלו.
// נקרא מ: auth.routes.js
// קורא ל: badRequest, revokeAllSessions, recordAudit, issueSession, מסד הנתונים (user)
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
// נקרא מ: auth.routes.js, וגם בקובץ הזה
// קורא ל: מסד הנתונים (refreshToken)
export async function revokeAllSessions(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// לפיתוח בלבד: אין ספק דואר, ולכן אסימון האיפוס מוחזר בתשובה
// במקום להישלח באימייל.
// יוצר אסימון חד-פעמי לאיפוס סיסמה.
// נקרא מ: auth.routes.js
// קורא ל: revokeAllSessions, מסד הנתונים (user)
export async function forgotPassword(dto) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) {
    return {}; // לא לחשוף אם האימייל קיים.
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
// קורא ל: badRequest, recordAudit, מסד הנתונים (user)
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

// אסימון גישה: קצר מועד (15 דקות), נשלח כ-"Authorization: Bearer ...".
// אסימון רענון: ארוך מועד (7 ימים), נשמר רק כגיבוב bcrypt כך שדליפה של המסד לא מאפשרת
// להשתמש בו; מזהה השורה שלו (jti) מאפשר לבטל אסימון יחיד.
// מנפיק אסימון גישה ואסימון רענון.
// נקרא מ: signUp, joinOrganization, signIn, refresh +1
// קורא ל: refreshExpiryDate, מסד הנתונים (refreshToken)
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

// "7d" -> תאריך בעוד 7 ימים.
// מחשב את תאריך התפוגה של אסימון הרענון.
// נקרא מ: issueSession
// קורא ל: —
function refreshExpiryDate() {
  const match = /^(\d+)([smhd])$/.exec(config.jwt.refreshTtl);
  const amount = match ? Number(match[1]) : 7;
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + amount * unitMs[match ? match[2] : 'd']);
}
