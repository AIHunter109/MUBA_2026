-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "recipientId" TEXT,
    "recipientAddress" TEXT,
    "amount" DECIMAL NOT NULL,
    "asset" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "digest" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'SENT',
    "network" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "asset", "createdAt", "digest", "failureReason", "id", "network", "paymentIntentId", "recipientAddress", "recipientId", "status", "updatedAt", "userId") SELECT "amount", "asset", "createdAt", "digest", "failureReason", "id", "network", "paymentIntentId", "recipientAddress", "recipientId", "status", "updatedAt", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_paymentIntentId_key" ON "Transaction"("paymentIntentId");
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");
CREATE INDEX "Transaction_userId_recipientId_createdAt_idx" ON "Transaction"("userId", "recipientId", "createdAt");
CREATE UNIQUE INDEX "Transaction_userId_digest_key" ON "Transaction"("userId", "digest");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
