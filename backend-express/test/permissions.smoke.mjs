// בדיקת הרשאות - רצה מול שרת פועל עם נתוני דמו טריים:
//   npm run prisma:seed && npm start      (בחלון נפרד)
//   npm run test:permissions
// מכסה: בעלות על פרויקט, ברירות המחדל של התפקידים, שינויי תפקיד בארגון, חריגים
// אישיים (מתן / שלילה / תפוגה), כללי ההגנה ויומן הביקורת.
// שימו לב: הבדיקה משנה נתונים (מוסיפה חבר לפרויקט) - יש לטעון מחדש את נתוני הדמו אחריה.

const B = process.env.API_URL ?? 'http://localhost:3000/api';
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email) {
  let r;
  for (;;) {
    r = await fetch(B + '/auth/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) });
    if (r.status !== 429) break;
    console.log('sign-in rate limit (5/min) - waiting 20s...');
    await sleep(20000);
  }
  const { accessToken } = await r.json();
  const H = { Authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' };
  const call = async (method, path, body) => {
    const res = await fetch(B + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
  const me = (await call('GET', '/users/me')).data;
  return { call, me };
}

const ava = await login('ava.reynolds@nimbusdigital.io'); // מנהל ארגון (וגם מנהל מערכת)
const daniel = await login('daniel.cho@nimbusdigital.io'); // מנהל פרויקט
const priya = await login('priya.sharma@nimbusdigital.io'); // עובד + חריג tasks.create
const marcus = await login('marcus.webb@nimbusdigital.io'); // עובד - חריג: בלי שיחות

// ---------- A. רגרסיה: מנהל פרויקט שולט רק בפרויקטים שלו ----------
let all = (await ava.call('GET', '/projects?scope=all')).data;
const mine = all.filter((p) => p.managerId === daniel.me.id);
let memberOnly = all.find((p) => p.taskCount > 0 && p.managerId !== daniel.me.id && p.members.some((m) => m.id === daniel.me.id));
if (!memberOnly) {
  // הופכים את Daniel לחבר רגיל בפרויקט שמישהו אחר מנהל.
  const target = all.find((p) => p.taskCount > 0 && p.managerId !== daniel.me.id);
  await ava.call('POST', `/projects/${target.id}/members`, { userId: daniel.me.id });
  memberOnly = target;
}
const dAll = (await daniel.call('GET', '/projects?scope=all')).data;
check('A1 PM scope=all = only his projects', dAll.length === mine.length && dAll.every((p) => p.can.update));
check('A2 PM edits his own project', (await daniel.call('PATCH', `/projects/${mine[0].id}`, { description: mine[0].description })).status === 200);
check("A3 PM edits a project he doesn't manage -> 403", (await daniel.call('PATCH', `/projects/${memberOnly.id}`, { description: 'x' })).status === 403);
const view = (await daniel.call('GET', `/projects/${memberOnly.id}`)).data;
check('A4 member-only project: can.manageTasks=false, can.comment=true', view.can.manageTasks === false && view.can.comment === true);

// ---------- B. /users/me מחזיר את ההרשאות בפועל ----------
check('B1 Priya has tasks.create via her exception', priya.me.permissions.includes('tasks.create'));
check('B2 Marcus lost calls.start via his exception', !marcus.me.permissions.includes('calls.start'));
check('B3 Daniel (PM) has no permissions.manage', !daniel.me.permissions.includes('permissions.manage'));

// ---------- C. החריג באמת עובד ----------
const priyaProjects = (await priya.call('GET', '/projects?scope=mine')).data;
const pp = priyaProjects[0];
check('C0 Priya sees can.createTasks in her project', pp && (await priya.call('GET', `/projects/${pp.id}`)).data.can.createTasks === true);
const board = (await priya.call('GET', `/projects/${pp.id}/board`)).data;
const ct = await priya.call('POST', '/tasks', { projectId: pp.id, columnId: board.columns[0].id, title: 'Bug found by QA', assigneeId: priya.me.id });
check('C1 Employee with exception creates a task (assigned to herself)', ct.status === 201, ct.data?.message);
const other = pp.members.find((m) => m.id !== priya.me.id);
const ct2 = await priya.call('POST', '/tasks', { projectId: pp.id, columnId: board.columns[0].id, title: 'x', assigneeId: other.id });
check('C2 ...but may not assign it to someone else -> 403', ct2.status === 403, ct2.data?.message);
const ct3 = await priya.call('PATCH', `/tasks/${ct.data?.id}`, { title: 'edit' });
check('C3 ...and still may not edit tasks (needs tasks.manage) -> 403', ct3.status === 403);
const lena = await login('lena.fischer@nimbusdigital.io'); // עובד רגיל, בלי חריג
const lp = (await lena.call('GET', '/projects?scope=mine')).data[0];
const lb = (await lena.call('GET', `/projects/${lp.id}/board`)).data;
check('C4 Employee WITHOUT the exception cannot create tasks -> 403', (await lena.call('POST', '/tasks', { projectId: lp.id, columnId: lb.columns[0].id, title: 'x' })).status === 403);

// ---------- D. חריג שלילה ----------
const md = await marcus.call('POST', '/meetings', { inviteeId: priya.me.id, mode: 'voice' });
check('D1 Marcus (calls.start denied) -> 403', md.status === 403, md.data?.message);
const pd = await priya.call('POST', '/meetings', { inviteeId: marcus.me.id, mode: 'voice' });
check('D2 Priya passes the permission check (503 = only Zoom keys missing)', pd.status === 503);

// ---------- E. גישה לטבלת ההרשאות ----------
const matrix = await ava.call('GET', '/permissions/matrix');
check('E1 Org Admin reads the matrix', matrix.status === 200 && matrix.data.roles.length === 4 && matrix.data.permissions.length > 10);
check('E2 PM cannot read the matrix -> 403', (await daniel.call('GET', '/permissions/matrix')).status === 403);

// ---------- F. שינוי תפקיד לארגון ----------
const rm = await ava.call('PUT', '/permissions/roles/EMPLOYEE/comments.create', { granted: false });
const empRow = rm.data.roles.find((r) => r.name === 'EMPLOYEE').permissions.find((p) => p.key === 'comments.create');
check('F1 Remove comments.create from Employees', rm.status === 200 && empRow.granted === false && empRow.source === 'organization');
const task = (await lena.call('GET', `/tasks?projectId=${lp.id}`)).data.items[0];
check('F2 ...an Employee can no longer comment -> 403 (takes effect immediately)', (await lena.call('POST', `/tasks/${task.id}/comments`, { body: 'hi' })).status === 403);
check('F3 ...a PM still can (his own role has it)', (await daniel.call('POST', `/tasks/${(await daniel.call('GET', `/tasks?projectId=${mine[0].id}`)).data.items[0].id}/comments`, { body: 'hi' })).status === 201);
await ava.call('PUT', '/permissions/roles/EMPLOYEE/comments.create', { granted: null });
check('F4 Reset to default -> Employee can comment again', (await lena.call('POST', `/tasks/${task.id}/comments`, { body: 'hi again' })).status === 201);

// ---------- G. כללי ההגנה ----------
const lock = await ava.call('PUT', '/permissions/roles/ORG_ADMIN/users.manage', { granted: false });
check("G1 Can't remove users.manage from Org Admins (lock-out) -> 403", lock.status === 403, lock.data?.message);
const sys = await ava.call('PUT', '/permissions/roles/EMPLOYEE/organizations.manage', { granted: true });
check("G2 Can't touch platform permissions -> 403", sys.status === 403);
const pmOnly = await ava.call('PUT', `/permissions/users/${priya.me.id}/tasks.manage`, { granted: true });
check('G3 Project-management permission for a non-PM -> 400', pmOnly.status === 400, pmOnly.data?.message);
const selfEdit = await ava.call('PUT', `/permissions/users/${ava.me.id}/audit.view`, { granted: false });
check("G4 Can't change your own permissions -> 403", selfEdit.status === 403);
const noPerm = await daniel.call('PUT', `/permissions/users/${priya.me.id}/tasks.create`, { granted: false });
check('G5 A PM (no permissions.manage) cannot give exceptions -> 403', noPerm.status === 403);
const past = await ava.call('PUT', `/permissions/users/${daniel.me.id}/audit.view`, { granted: true, expiresAt: '2020-01-01' });
check('G6 Expiry in the past -> 400', past.status === 400);
const bogus = await ava.call('PUT', `/permissions/users/${daniel.me.id}/nope.nope`, { granted: true });
check('G7 Unknown permission -> 404', bogus.status === 404);

// ---------- H. שלילה אישית והסבר ----------
await ava.call('PUT', `/permissions/users/${daniel.me.id}/reports.view`, { granted: false, reason: 'test' });
check('H1 Deny reports.view for Daniel -> dashboard 403', (await daniel.call('GET', '/tasks/dashboard-summary')).status === 403);
const explain = (await ava.call('GET', `/permissions/users/${daniel.me.id}`)).data;
const rv = explain.permissions.find((p) => p.key === 'reports.view');
check('H2 Explanation shows source=user, roleGranted=true', rv.granted === false && rv.source === 'user' && rv.roleGranted === true);
await ava.call('PUT', `/permissions/users/${daniel.me.id}/reports.view`, { granted: null });
check('H3 Remove the exception -> dashboard 200 again', (await daniel.call('GET', '/tasks/dashboard-summary')).status === 200);

// ---------- I. חריג זמני שפג תוקפו ----------
const soon = new Date(Date.now() + 3000).toISOString();
await ava.call('PUT', `/permissions/users/${daniel.me.id}/audit.view`, { granted: true, expiresAt: soon, reason: 'audit week' });
check('I1 Temporary audit.view for Daniel -> audit log 200', (await daniel.call('GET', '/audit-log?pageSize=1')).status === 200);
await sleep(3500);
check('I2 ...after it expires -> 403', (await daniel.call('GET', '/audit-log?pageSize=1')).status === 403);
const ex = (await ava.call('GET', `/permissions/users/${daniel.me.id}`)).data.overrides.find((o) => o.key === 'audit.view');
check('I3 Expired exception is still listed, marked expired', ex?.expired === true);
await ava.call('PUT', `/permissions/users/${daniel.me.id}/audit.view`, { granted: null });

// ---------- J. יומן הביקורת ----------
const audit = (await ava.call('GET', '/audit-log?pageSize=30&search=PERMISSION')).data.items.map((i) => i.action);
check('J1 Changes are in the audit log', audit.includes('ROLE_PERMISSION_CHANGED') && audit.includes('USER_PERMISSION_CHANGED'));

// ניקוי: משימת הבדיקה של Priya
if (ct.data?.id) await ava.call('DELETE', `/tasks/${ct.data.id}`);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.startsWith('PASS')) ? 0 : 1;
