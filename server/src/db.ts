import { PrismaClient } from '@prisma/client';

/**
 * One shared Prisma client for the process. Datasource is Postgres (Supabase) -
 * connection string comes from DATABASE_URL (prisma/.env locally, host env vars
 * in deployment). See prisma/schema.prisma.
 */
export const prisma = new PrismaClient();
