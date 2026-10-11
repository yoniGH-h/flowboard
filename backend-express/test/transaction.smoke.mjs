// ביצוע החלטה הוא "הכל או כלום" (סעיף 8.3 במסמך האפיון). רצה מול מסד עם נתוני דמו טריים
// (DATABASE_URL), וקוראת ישירות ל-service של התכנון:
//   1. החלטה שהשלב האחרון שלה נכשל לא משאירה עקבות: חבר הצוות שנוסף, המשימות
//      שנדחו וההתראה שנוצרה - כולם מבוטלים;
//   2. אותה החלטה עם קלט תקין מתבצעת במלואה;
//   3. עבודה שנכנסה לתור עם afterCommit (שליחת התראות לדפדפנים) רצה רק אחרי שמירה.
// שימוש: npm run test:transaction
import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const { prisma, inTransaction, afterCommit } = await import('../src/db.js');
const { config } = await import('../src/config.js');
const { authenticateAccessToken } = await import('../src/middleware/auth.js');
const planning = await import('../src/modules/planning/planning.service.js');

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

// המנהל שמבצע את הפעולה, בדיוק כמו ש-requireAuth בונה אותו.
const daniel = await prisma.user.findUniqueOrThrow({ where: { email: 'daniel.cho@nimbusdigital.io' } });
const token = jwt.sign({ sub: daniel.id, email: daniel.email, organizationId: daniel.organizationId, roles: [] }, config.jwt.accessSecret);
const actor = await authenticateAccessToken(token);

const project = await prisma.project.findFirstOrThrow({ where: { name: 'Atlas Customer Portal' } });
const toDefer = await prisma.task.findMany({
  where: { projectId: project.id, archived: false, completedAt: null, column: { category: 'TODO' } },
  orderBy: { createdAt: 'asc' },
  take: 2,
});
const memberIds = (await prisma.projectMember.findMany({ where: { projectId: project.id } })).map((m) => m.userId);
const newMember = await prisma.user.findFirstOrThrow({
  where: { organizationId: daniel.organizationId, status: 'ACTIVE', id: { notIn: memberIds } },
});
const changes = { addMemberIds: [newMember.id], deferTaskIds: toDefer.map((t) => t.id) };

const snapshot = async () => ({
  member: await prisma.projectMember.count({ where: { projectId: project.id, userId: newMember.id } }),
  archived: (await prisma.task.findMany({ where: { id: { in: changes.deferTaskIds } }, orderBy: { createdAt: 'asc' } })).map((t) => t.archived),
  notifications: await prisma.notification.count({ where: { userId: newMember.id } }),
  decisions: await prisma.decision.count({ where: { projectId: project.id } }),
  audits: await prisma.auditLogEntry.count({ where: { projectId: project.id } }),
});

await check('setup: one person to add and two tasks to defer', async () => {
  assert.equal(toDefer.length, 2);
});

await check('a decision whose last step fails is rolled back completely', async () => {
  const before = await snapshot();
  // תאריך יעד לא תקין עובר את מודל התכנון (הנתיב ב-API היה דוחה אותו; כאן
  // קוראים ל-service ישירות) ונכשל רק כשמעדכנים את הפרויקט - השינוי
  // האחרון, אחרי שחבר הצוות נוסף ושתי המשימות נדחו.
  await assert.rejects(
    planning.applyDecision(actor, project.id, { changes: { ...changes, newTargetDate: new Date(Number.NaN) }, source: 'SIMULATOR', note: 'rollback test' }),
  );
  assert.deepEqual(await snapshot(), before, 'member, tasks, notifications, decisions and audit log unchanged');
});

await check('the same decision with valid input is applied completely', async () => {
  const before = await snapshot();
  const decision = await planning.applyDecision(actor, project.id, { changes, source: 'SIMULATOR', note: 'commit test' });
  const after = await snapshot();
  assert.ok(decision.id);
  assert.equal(after.member, 1);
  assert.deepEqual(after.archived, [true, true]);
  assert.equal(after.notifications, before.notifications + 1, 'the new member was notified');
  assert.equal(after.decisions, before.decisions + 1);
});

await check('afterCommit work runs only when the transaction commits', async () => {
  let pushed = 0;
  await assert.rejects(
    inTransaction(async () => {
      afterCommit(() => (pushed += 1));
      throw new Error('roll back');
    }),
  );
  assert.equal(pushed, 0, 'nothing pushed after a rollback');
  await inTransaction(async () => afterCommit(() => (pushed += 1)));
  assert.equal(pushed, 1, 'pushed once after a commit');
  afterCommit(() => (pushed += 1));
  assert.equal(pushed, 2, 'outside a transaction it runs immediately');
});

await prisma.$disconnect();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll transaction checks passed');
process.exit(failures ? 1 : 0);
