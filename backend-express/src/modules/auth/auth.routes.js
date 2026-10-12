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

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// ---------- מגבלות קצב מחמירות לנתיבים שמנסים לפרוץ בניחוש ----------

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

authRouter.post('/sign-up', async (req, res) => {
  const tokens = await authService.signUp(parse(signUpSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json(tokens);
});

authRouter.post('/join-organization', async (req, res) => {
  const tokens = await authService.joinOrganization(parse(joinOrganizationSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json(tokens);
});

authRouter.post('/sign-in', limit(5), async (req, res) => {
  const tokens = await authService.signIn(parse(signInSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

authRouter.post('/refresh', limit(30), async (req, res) => {
  const dto = parse(refreshTokenSchema, req.body);
  const token = dto.refreshToken ?? req.cookies[REFRESH_COOKIE];
  if (!token) throw unauthorized('Refresh token is required');

  const tokens = await authService.refresh(token);
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

authRouter.post('/logout', async (req, res) => {
  const dto = parse(refreshTokenSchema, req.body);
  const token = dto.refreshToken ?? req.cookies[REFRESH_COOKIE];
  if (token) await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
  res.status(204).end();
});

authRouter.post('/forgot-password', limit(3), async (req, res) => {
  res.json(await authService.forgotPassword(parse(forgotPasswordSchema, req.body)));
});

authRouter.post('/reset-password', limit(5), async (req, res) => {
  await authService.resetPassword(parse(resetPasswordSchema, req.body));
  res.status(204).end();
});

// משתמש מחובר משנה את הסיסמה של עצמו (מסך הפרופיל). כל חיבור אחר שלו
// מנותק; הדפדפן הזה מקבל זוג אסימונים חדש ונשאר מחובר.
authRouter.post('/change-password', limit(5), requireAuth, async (req, res) => {
  const tokens = await authService.changePassword(req.user, parse(changePasswordSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

// מנתק את המשתמש מכל המכשירים.
authRouter.post('/sessions/revoke-all', requireAuth, async (req, res) => {
  await authService.revokeAllSessions(req.user.userId);
  res.status(204).end();
});
