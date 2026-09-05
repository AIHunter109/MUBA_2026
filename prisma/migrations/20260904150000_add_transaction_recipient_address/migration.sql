-- Preserve the destination for transfers to unsaved recipients as well as saved ones.
ALTER TABLE "Transaction" ADD COLUMN "recipientAddress" TEXT;
