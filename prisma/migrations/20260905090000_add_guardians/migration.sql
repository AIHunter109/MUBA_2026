CREATE TABLE "Guardian" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Guardian_userId_address_key" ON "Guardian"("userId", "address");
CREATE INDEX "Guardian_address_idx" ON "Guardian"("address");
CREATE TABLE "ApprovalPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "thresholdUsdc" DECIMAL, "thresholdSui" DECIMAL,
  "requireNewRecipient" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ApprovalPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ApprovalPolicy_userId_key" ON "ApprovalPolicy"("userId");
CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "guardianId" TEXT NOT NULL, "recipient" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL, "asset" TEXT NOT NULL, "reason" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ApprovalRequest_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ApprovalRequest_guardianId_status_idx" ON "ApprovalRequest"("guardianId", "status");
CREATE INDEX "ApprovalRequest_userId_status_idx" ON "ApprovalRequest"("userId", "status");
