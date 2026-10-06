// Authentication against the Express backend: sign-in, sign-up, session and password reset.
import { http, getErrorMessage } from './http';
import { setTokens, clearTokens } from './session';

export function highestRole(roles) {
  const order = ['SYSTEM_ADMIN', 'ORG_ADMIN', 'PROJECT_MANAGER', 'EMPLOYEE'];
  return order.find((r) => roles.includes(r)) ?? 'EMPLOYEE';
}

async function hydrateSession() {
  const [{ data: user }, { data: organization }] = await Promise.all([http.get('/users/me'), http.get('/organizations/current')]);
  return { user, organization };
}

export async function signIn(email, password) {
  try {
    const { data } = await http.post('/auth/sign-in', { email, password });
    setTokens(data);
    return await hydrateSession();
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to sign in.'), { cause: error });
  }
}

export async function signUpCreateOrganization(input) {
  try {
    const { data } = await http.post('/auth/sign-up', input);
    setTokens(data);
    return await hydrateSession();
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create your organization.'), { cause: error });
  }
}

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

export async function requestPasswordReset(email) {
  const { data } = await http.post('/auth/forgot-password', { email });
  return { sent: true, resetToken: data.resetToken };
}

export async function resetPassword(token, newPassword) {
  try {
    await http.post('/auth/reset-password', { token, newPassword });
    return { success: true };
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to reset your password.'), { cause: error });
  }
}

export async function signOut() {
  clearTokens();
  await http.post('/auth/logout', {}).catch(() => undefined);
}

export async function fetchCurrentSession() {
  try {
    return await hydrateSession();
  } catch {
    return null;
  }
}
