CREATE TABLE "BudgetPlan" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "recipientName" TEXT NOT NULL, "recipientAddress" TEXT NOT NULL,
  "income" DECIMAL NOT NULL, "essentials" DECIMAL NOT NULL, "savings" DECIMAL NOT NULL, "monthlySupport" DECIMAL NOT NULL,
  "remaining" DECIMAL NOT NULL, "asset" TEXT NOT NULL, "frequency" TEXT NOT NULL, "result" TEXT NOT NULL, "explanation" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BudgetPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BudgetPlan_userId_createdAt_idx" ON "BudgetPlan"("userId", "createdAt");
