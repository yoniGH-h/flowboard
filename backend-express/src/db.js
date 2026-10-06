// One shared Prisma client for the whole app. Prisma 7 always talks to Postgres through an
// explicit driver adapter (@prisma/adapter-pg), not a URL inside schema.prisma.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
