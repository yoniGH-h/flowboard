// Decision Center smoke test - runs against a RUNNING server with freshly seeded demo data:
//   npm run prisma:seed && npm start      (in another terminal)
//   npm run test:planning
// Prints the recommendations, a simulation, validation / permission checks, applies one
// decision and shows the decision log. It changes data - re-seed afterwards for a clean demo.

const B = process.env.API_URL ?? 'http://localhost:3000/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email) {
  let r;
  for (;;) {
    r = await fetch(B + '/auth/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) });
    if (r.status !== 429) break;
    await sleep(20000);
  }
  const { accessToken } = await r.json();
  const H = { Authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' };
  return async (method, path, body) => {
    const res = await fetch(B + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}
const ava = await login('ava.reynolds@nimbusdigital.io');
const daniel = await login('daniel.cho@nimbusdigital.io');
const priya = await login('priya.sharma@nimbusdigital.io');
const fmt = (e) => `risk ${e.riskScore} | forecast ${e.forecast.status}${e.forecast.daysLate != null ? ` ${e.forecast.daysLate}d` : ''} | open ${e.openTasks}`;

const projects = (await ava('GET', '/projects?scope=all')).data;
const atlas = projects.find((p) => p.name === 'Atlas Customer Portal');
const billing = projects.find((p) => p.name === 'Billing Platform Migration');

// --- view ---
const view = (await daniel('GET', `/planning/projects/${atlas.id}`)).data;
console.log('ATLAS now:', fmt(view.evaluation), '| people:', view.people.length, '| open tasks:', view.openTasks.length);

// --- recommendations ---
for (const p of [atlas, billing]) {
  const recs = await ava('GET', `/planning/projects/${p.id}/recommendations`);
  console.log(`\nRECOMMENDATIONS ${p.name} (${recs.status}):`);
  for (const r of recs.data) {
    console.log(` - [${r.type}] ${r.title}\n     why: ${r.reason}\n     effect: ${fmt(r.before)}  ->  ${fmt(r.after)}${r.loadChanges.length ? ' | load: ' + r.loadChanges.map((l) => `${l.name} ${l.before}->${l.after}`).join(', ') : ''}`);
  }
}

// --- simulate a combination ---
const low = view.openTasks.filter((t) => t.priority === 'LOW');
const nonMember = view.people.find((p) => !p.isMember && p.openTotal <= 2);
const sim = await daniel('POST', `/planning/projects/${atlas.id}/simulate`, {
  changes: { deferTaskIds: low.map((t) => t.id).slice(0, 2), addMemberIds: nonMember ? [nonMember.userId] : undefined },
});
console.log('\nSIMULATE defer+add:', sim.status, '\n  before:', fmt(sim.data.before), '\n  after: ', fmt(sim.data.after));
console.log('  changes:', sim.data.changes.map((c) => c.text));
console.log('  assumptions:', sim.data.assumptions.length);

// --- validation / permissions ---
const outsider = view.people.find((p) => !p.isMember);
const bad = await daniel('POST', `/planning/projects/${atlas.id}/simulate`, { changes: { reassign: [{ taskId: view.openTasks[0].id, toUserId: outsider.userId }] } });
console.log('\nreassign to non-member ->', bad.status, bad.data.message);
console.log('empty changes ->', (await daniel('POST', `/planning/projects/${atlas.id}/simulate`, { changes: {} })).status);
console.log("Daniel plans someone else's project ->", (await daniel('GET', `/planning/projects/${billing.id}`)).status);
console.log('Priya (employee) ->', (await priya('GET', `/planning/projects/${atlas.id}`)).status);

// --- apply a decision (Daniel defers one low task on his own project) ---
if (low[0]) {
  const dec = await daniel('POST', `/planning/projects/${atlas.id}/decisions`, { changes: { deferTaskIds: [low[0].id] }, source: 'SIMULATOR', note: 'Cut from v1' });
  console.log('\nAPPLY decision ->', dec.status, dec.data.title, '| risk', dec.data.riskBefore, '-> predicted', dec.data.riskPredicted);
  const task = await daniel('GET', `/tasks/${low[0].id}`);
  console.log('  task archived now:', task.data.archived);
}

// --- decision log ---
const log = await ava('GET', '/planning/decisions');
console.log('\nDECISION LOG (Ava):', log.status);
for (const d of log.data) console.log(` - ${d.project.name}: ${d.title} | ${d.daysAgo}d ago by ${d.actor.firstName} | risk ${d.riskBefore} -> predicted ${d.riskPredicted} -> now ${d.riskNow}`);
console.log('DECISION LOG (Daniel sees only his projects):', (await daniel('GET', '/planning/decisions')).data.map((d) => d.project.name));
