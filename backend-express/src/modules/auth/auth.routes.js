// נתיבי ההתחברות.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../../config.js';
import { requireAuth } from '../../middleware/auth.js';
import { unauthorized } from '../../utils/httpError.js';
import { nonEmptyString, parse } from '../../utils/validate.js';
import * as authService from './auth.service.js';

// ---------- בדיקת קלט ----------

const signUpSchema = z.strictObject({
  firstName: nonEmptyString,
  lastName: nonEmptyString,
  email: z.email(),
  password: z.string().min(8),
  organizationName: nonEmptyString,
});

const joinOrganizationSchema = z.strictObject({
  firstName: nonEmptyString,
  lastName: nonEmptyString,
  email: z.email(),
  password: z.string().min(8),
  organizationSlug: nonEmptyString,
});

const signInSchema = z.strictObject({
  email: z.email(),
  password: nonEmptyString,
});

// אסימון הרענון מגיע בדרך כלל מעוגיית ה-httpOnly; השדה בגוף הבקשה אופציונלי.
const refreshTokenSchema = z.strictObject({
  refreshToken: nonEmptyString.optional(),
});

const forgotPasswordSchema = z.strictObject({ email: z.email() });

const changePasswordSchema = z.strictObject({
  currentPassword: nonEmptyString,
  newPassword: z.string().min(8),
});

const resetPasswordSchema = z.strictObject({
  token: nonEmptyString,
  newPassword: z.string().min(8),
});

// ---------- עוגיית אסימון הרענון ----------
// httpOnly אומר שקוד JavaScript בדף לא יכול לקרוא אותה (הגנה מפני גניבה ב-XSS),
// ו-path=/api/auth אומר שהדפדפן שולח אותה רק לנתיבי ההתחברות.

const REFRESH_COOKIE = 'flowboard_refresh';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax',
  path: '/api/auth',
};

// שם את אסימון הרענון בעוגיית httpOnly.
// נקרא מ: POST /sign-up, POST /join-organization, POST /sign-in, POST /refresh +1
// קורא ל: —
function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// ---------- מגבלות קצב מחמירות לנתיבים שמנסים לפרוץ בניחוש ----------

// יוצר מגבלת קצב לנתיב רגיש.
// נקרא מ: POST /sign-in, POST /refresh, POST /forgot-password, POST /reset-password +1
// קורא ל: —
const limit = (max) => {
  if (!config.rateLimitEnabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 60_000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        statusCode: 429,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        message: 'Too many requests. Please wait a minute and try again.',
      }),
  });
};

// ---------- נתיבים ----------

// הראוטר של ההתחברות (נתיבים ציבוריים ברובם).
// נקרא מ: app.js
export const authRouter = Router();

// הרשמה: יוצר ארגון חדש ואת המשתמש הראשון שלו כמנהל הארגון.
// נקרא מ: signUpCreateOrganization (authApi.js)
// קורא ל: authService.signUp, parse, setRefreshCookie
authRouter.post('/sign-up', async (req, res) => {
  const tokens = await authService.signUp(parse(signUpSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json(tokens);
});

// הרשמה לארגון קיים כעובד.
// נקרא מ: signUpJoinOrganization (authApi.js)
// קורא ל: authService.joinOrganization, parse, setRefreshCookie
authRouter.post('/join-organization', async (req, res) => {
  const tokens = await authService.joinOrganization(parse(joinOrganizationSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json(tokens);
});

// כניסה: בודק סיסמה, מטפל בנעילה ומנפיק אסימונים.
// נקרא מ: signIn (authApi.js)
// קורא ל: limit, authService.signIn, parse, setRefreshCookie
authRouter.post('/sign-in', limit(5), async (req, res) => {
  const tokens = await authService.signIn(parse(signInSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

// מחליף אסימון רענון תקף בזוג אסימונים חדש.
// נקרא מ: refreshAccessToken (http.js)
// קורא ל: limit, parse, unauthorized, authService.refresh, setRefreshCookie
authRouter.post('/refresh', limit(30), async (req, res) => {
  const dto = parse(refreshTokenSchema, req.body);
  const token = dto.refreshToken ?? req.cookies[REFRESH_COOKIE];
  if (!token) throw unauthorized('Refresh token is required');

  const tokens = await authService.refresh(token);
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

// יציאה: מבטל את אסימון הרענון.
// נקרא מ: signOut (authApi.js)
// קורא ל: parse, authService.logout
authRouter.post('/logout', async (req, res) => {
  const dto = parse(refreshTokenSchema, req.body);
  const token = dto.refreshToken ?? req.cookies[REFRESH_COOKIE];
  if (token) await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
  res.status(204).end();
});

// יוצר אסימון חד-פעמי לאיפוס סיסמה.
// נקרא מ: requestPasswordReset (authApi.js)
// קורא ל: limit, authService.forgotPassword, parse
authRouter.post('/forgot-password', limit(3), async (req, res) => {
  res.json(await authService.forgotPassword(parse(forgotPasswordSchema, req.body)));
});

// קובע סיסמה חדשה לפי אסימון האיפוס.
// נקרא מ: resetPassword (authApi.js)
// קורא ל: limit, authService.resetPassword, parse
authRouter.post('/reset-password', limit(5), async (req, res) => {
  await authService.resetPassword(parse(resetPasswordSchema, req.body));
  res.status(204).end();
});

// משתמש מחובר משנה את הסיסמה של עצמו (מסך הפרופיל). כל חיבור אחר שלו
// מנותק; הדפדפן הזה מקבל זוג אסימונים חדש ונשאר מחובר.
// שינוי סיסמה למשתמש מחובר, וביטול שאר החיבורים שלו.
// נקרא מ: changePassword (authApi.js)
// קורא ל: limit, requireAuth, authService.changePassword, parse, setRefreshCookie
authRouter.post('/change-password', limit(5), requireAuth, async (req, res) => {
  const tokens = await authService.changePassword(req.user, parse(changePasswordSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

// מנתק את המשתמש מכל המכשירים.
// מבטל את כל אסימוני הרענון של משתמש.
// נקרא מ: אין קריאה מהאתר
// קורא ל: requireAuth, authService.revokeAllSessions
authRouter.post('/sessions/revoke-all', requireAuth, async (req, res) => {
  await authService.revokeAllSessions(req.user.userId);
  res.status(204).end();
});
