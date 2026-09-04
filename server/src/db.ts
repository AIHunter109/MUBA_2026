import { PrismaClient } from '@prisma/client';

/**
 * One shared Prisma client for the process. Local dev is SQLite (prisma/dev.db);
 * swap the datasource in prisma/schema.prisma for a real deployment.
 */
export const prisma = new PrismaClient();
