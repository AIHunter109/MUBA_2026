-- Existing rules historically represented monthly payments.
ALTER TABLE "RecurringRule" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'MONTHLY';
