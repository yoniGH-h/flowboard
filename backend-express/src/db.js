// החיבור למסד הנתונים, וטרנזקציות.

// לקוח Prisma אחד משותף לכל האפליקציה. Prisma 7 מתחבר ל-Postgres דרך
// מתאם (@prisma/adapter-pg) ולא דרך כתובת בתוך schema.prisma.
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

const adapter = new PrismaPg({ connectionString: config.databaseUrl });
const client = new PrismaClient({ adapter });

// ---------- טרנזקציות שעוברות בין כמה services ----------
// inTransaction(fn) מריץ את fn בתוך טרנזקציה אחת: אם משהו בה זורק שגיאה, כל
// שינוי שנעשה מתבטל ("הכל או כלום"). ה-services לא צריכים לדעת על זה -
// בזמן ש-fn רץ, המשתנה prisma שלמטה מפנה אל הטרנזקציה, כך שכל שאילתה של כל service
// שנקרא מתוך fn מצטרפת אליה אוטומטית (AsyncLocalStorage עוקב אחרי הקריאות האסינכרוניות).
// עבודה שמותר לבצע רק אחרי שהנתונים באמת נשמרו (שליחת התראה לדפדפן)
// נכנסת לתור דרך afterCommit() ורצה רק אם הטרנזקציה הצליחה.
const context = new AsyncLocalStorage();

// מריץ פונקציה בתוך טרנזקציה אחת: הכל נשמר או הכל מתבטל.
export async function inTransaction(fn) {
  const afterCommitQueue = [];
  const result = await client.$transaction((tx) => context.run({ tx, afterCommitQueue }, fn), {
    timeout: 20_000,
  });
  for (const task of afterCommitQueue) task();
  return result;
}

// מריץ פעולה רק אחרי שהטרנזקציה נשמרה (או מיד, אם אין טרנזקציה).
export function afterCommit(task) {
  const store = context.getStore();
  if (store) store.afterCommitQueue.push(task);
  else task();
}

// הלקוח של מסד הנתונים שכל השרת משתמש בו; בתוך טרנזקציה מפנה אליה אוטומטית.
export const prisma = new Proxy(client, {
  get(target, prop) {
    const tx = context.getStore()?.tx;
    if (!tx) {
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    }
    // בתוך טרנזקציה, אצווה ($transaction([...])) פשוט רצה על אותה טרנזקציה.
    if (prop === '$transaction') return (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(tx));
    const value = Reflect.get(tx, prop);
    return typeof value === 'function' ? value.bind(tx) : value;
  },
});
