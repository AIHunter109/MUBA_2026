ALTER TABLE "ApprovalPolicy" ADD COLUMN "requireChangedWallet" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ApprovalRequest" ADD COLUMN "triggers" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Recipient" ADD COLUMN "walletChangedAt" DATETIME;
