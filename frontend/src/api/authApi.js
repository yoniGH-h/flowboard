// תפקיד הקובץ: הקריאות לשרת בנושא התחברות: כניסה, הרשמה, סיסמאות והמשתמש הנוכחי.
// משתמשים בו: AuthContext.jsx, ForgotPasswordPage.jsx, ResetPasswordPage.jsx, SignInPage.jsx +3

// התחברות מול השרת (Express): כניסה, הרשמה, המשתמש הנוכחי ואיפוס סיסמה.
import { http, getErrorMessage } from './http';
import { setTokens, clearTokens } from './session';

// מחזיר את התפקיד הגבוה ביותר מתוך רשימה.
// נקרא מ: AuthContext.jsx
export function highestRole(roles) {
  const order = ['SYSTEM_ADMIN', 'ORG_ADMIN', 'PROJECT_MANAGER', 'EMPLOYEE'];
  return order.find((r) => roles.includes(r)) ?? 'EMPLOYEE';
}

async function hydrateSession() {
  const [{ data: user }, { data: organization }] = await Promise.all([http.get('/users/me'), http.get('/organizations/current')]);
  return { user, organization };
}

// כניסה עם אימייל וסיסמה.
// נקרא מ: SignInPage.jsx, SignInPage.test.jsx
export async function signIn(email, password) {
  try {
    const { data } = await http.post('/auth/sign-in', { email, password });
    setTokens(data);
    return await hydrateSession();
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to sign in.'), { cause: error });
  }
}

// הרשמה עם יצירת ארגון חדש.
// נקרא מ: SignUpPage.jsx
export async function signUpCreateOrganization(input) {
  try {
    const { data } = await http.post('/auth/sign-up', input);
    setTokens(data);
    return await hydrateSession();
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create your organization.'), { cause: error });
  }
}

// הרשמה לארגון קיים.
// נקרא מ: SignUpPage.jsx
export async function signUpJoinOrganization(input) {
  try {
    const { data } = await http.post('/auth/join-organization', {
      organizationSlug: input.organizationSlugOrInviteCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password,
    });
    setTokens(data);
    return await hydrateSession();
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to join that organization.'), { cause: error });
  }
}

// מבקש איפוס סיסמה.
// נקרא מ: ForgotPasswordPage.jsx
export async function requestPasswordReset(email) {
  const { data } = await http.post('/auth/forgot-password', { email });
  return { sent: true, resetToken: data.resetToken };
}

// קובע סיסמה חדשה לפי אסימון האיפוס.
// נקרא מ: ResetPasswordPage.jsx
export async function resetPassword(token, newPassword) {
  try {
    await http.post('/auth/reset-password', { token, newPassword });
    return { success: true };
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to reset your password.'), { cause: error });
  }
}

// מסך הפרופיל: שינוי הסיסמה של המשתמש המחובר. השרת מנתק כל חיבור אחר
// ומחזיר אסימונים חדשים לחיבור הזה.
// משנה סיסמה למשתמש מחובר.
// נקרא מ: ProfileSettingsPage.jsx
export async function changePassword(currentPassword, newPassword) {
  try {
    const { data } = await http.post('/auth/change-password', { currentPassword, newPassword });
    setTokens(data);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to change your password.'), { cause: error });
  }
}

// יציאה: מודיע לשרת ומוחק את האסימון.
// נקרא מ: AuthContext.jsx
export async function signOut() {
  clearTokens();
  await http.post('/auth/logout', {}).catch(() => undefined);
}

// שולף את המשתמש המחובר ואת הארגון שלו.
// נקרא מ: AuthContext.jsx
export async function fetchCurrentSession() {
  try {
    return await hydrateSession();
  } catch {
    return null;
  }
}
