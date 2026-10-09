// One shared Prisma client for the whole app. Prisma 7 always talks to Postgres through an
// explicit driver adapter (@prisma/adapter-pg), not a URL inside schema.prisma.
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

const adapter = new PrismaPg({ connectionString: config.databaseUrl });
const client = new PrismaClient({ adapter });

// ---------- Transactions that span several services ----------
// inTransaction(fn) runs fn inside one database transaction: if anything in it throws, every
// change it made is rolled back ("all or nothing"). The services don't need to know about it -
// while fn runs, `prisma` below points at the transaction, so every query made by any service
// called from fn joins it automatically (AsyncLocalStorage follows the async calls).
// Work that must only happen once the data is really saved (pushing a notification to a
// browser) is queued with afterCommit() and runs only if the transaction commits.
const context = new AsyncLocalStorage();

export async function inTransaction(fn) {
  const afterCommitQueue = [];
  const result = await client.$transaction((tx) => context.run({ tx, afterCommitQueue }, fn), {
    timeout: 20_000,
  });
  for (const task of afterCommitQueue) task();
  return result;
}

// Runs `task` now, or - inside inTransaction - right after the transaction commits.
export function afterCommit(task) {
  const store = context.getStore();
  if (store) store.afterCommitQueue.push(task);
  else task();
}

export const prisma = new Proxy(client, {
  get(target, prop) {
    const tx = context.getStore()?.tx;
    if (!tx) {
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    }
    // Inside a transaction a batch ($transaction([...])) simply runs on the same transaction.
    if (prop === '$transaction') return (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(tx));
    const value = Reflect.get(tx, prop);
    return typeof value === 'function' ? value.bind(tx) : value;
  },
});
