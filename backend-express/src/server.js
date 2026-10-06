// Entry point: `npm start` (or `npm run dev` to restart on every file change).
import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { runScans } from './modules/automation-rules/automation-rules.service.js';
import { recordRiskSnapshots } from './modules/projects/projects.service.js';
import { initRealtime } from './realtime/socket.js';

// Express and Socket.IO share one HTTP server (and one port).
const httpServer = createServer(app);
initRealtime(httpServer);

// Scan-based automation rules (overdue / due soon) run every 15 minutes.
const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const scanTimer = setInterval(async () => {
  try {
    const { rulesEvaluated, actionsExecuted } = await runScans();
    if (actionsExecuted > 0) {
      console.log(`Automation scan: ${rulesEvaluated} rule(s) evaluated, ${actionsExecuted} action(s) executed`);
    }
  } catch (error) {
    console.error('Automation scan failed:', error);
  }
}, SCAN_INTERVAL_MS);

// Today's delay-risk score of every project is saved hourly (and once at startup), building
// the history behind the risk trend chart.
async function snapshotRisk() {
  try {
    await recordRiskSnapshots();
  } catch (error) {
    console.error('Risk snapshot failed:', error);
  }
}
const riskTimer = setInterval(snapshotRisk, 60 * 60 * 1000);

await prisma.$connect();
await snapshotRisk();
httpServer.listen(config.port, () => {
  console.log(`FlowBoard API (Express) listening on http://localhost:${config.port}/api`);
});

// Ctrl+C: stop accepting requests and close the database connection cleanly.
async function shutdown() {
  clearInterval(scanTimer);
  clearInterval(riskTimer);
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
