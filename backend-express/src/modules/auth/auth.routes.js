import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../../config.js';
import { requireAuth } from '../../middleware/auth.js';
import { unauthorized } from '../../utils/httpError.js';
import { nonEmptyString, parse } from '../../utils/validate.js';
import * as authService from './auth.service.js';

// ---------- Validation ----------

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

// The refresh token normally comes from the httpOnly cookie; the body field is optional.
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

// ---------- Refresh-token cookie ----------
// httpOnly means page JavaScript can never read it (protects against XSS stealing it), and
// path=/api/auth means the browser only sends it to the auth endpoints.

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

// ---------- Stricter rate limits for brute-force targets ----------

const limit = (max) =>
  rateLimit({
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

// ---------- Routes ----------

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

// A signed-in user changes their own password (Profile & Settings). Every other session is
// signed out; this browser gets a fresh pair of tokens so it stays signed in.
authRouter.post('/change-password', limit(5), requireAuth, async (req, res) => {
  const tokens = await authService.changePassword(req.user, parse(changePasswordSchema, req.body));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

// Signs the user out everywhere.
authRouter.post('/sessions/revoke-all', requireAuth, async (req, res) => {
  await authService.revokeAllSessions(req.user.userId);
  res.status(204).end();
});
