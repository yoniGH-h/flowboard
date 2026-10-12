// נקודת הכניסה של השרת.

// נקודת הכניסה: npm start (או npm run dev, שמפעיל מחדש בכל שינוי בקובץ).
import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { runScans } from './modules/automation-rules/automation-rules.service.js';
import { recordRiskSnapshots } from './modules/projects/projects.service.js';
import { initRealtime } from './realtime/socket.js';

// Express ו-Socket.IO חולקים שרת HTTP אחד (ופורט אחד).
const httpServer = createServer(app);
initRealtime(httpServer);

// חוקי האוטומציה שמבוססים על סריקה (באיחור / מועד מתקרב) רצים כל 15 דקות.
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

// ציון הסיכון של היום נשמר לכל פרויקט פעם בשעה (ופעם אחת בהפעלה), וכך נבנית
// ההיסטוריה שמאחורי גרף מגמת הסיכון.
// שומר את ציוני הסיכון של היום.
// נקרא מ: הקובץ הזה
// קורא ל: recordRiskSnapshots
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

// Ctrl+C: מפסיקים לקבל בקשות וסוגרים את החיבור למסד בצורה מסודרת.
// סוגר את השרת ואת החיבור למסד בצורה מסודרת.
// נקרא מ: הקובץ הזה
// קורא ל: —
async function shutdown() {
  clearInterval(scanTimer);
  clearInterval(riskTimer);
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
