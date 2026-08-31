-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT 'regie',
    "rate" INTEGER,
    "forfaitAmount" INTEGER,
    "startDate" TEXT,
    "endDate" TEXT,
    "estimatedDays" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "billing" TEXT NOT NULL DEFAULT 'pending',
    "billedAt" TEXT,
    "paidAt" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Mission" ("clientId", "createdAt", "endDate", "estimatedDays", "id", "notes", "rate", "startDate", "status", "title", "updatedAt") SELECT "clientId", "createdAt", "endDate", "estimatedDays", "id", "notes", "rate", "startDate", "status", "title", "updatedAt" FROM "Mission";
DROP TABLE "Mission";
ALTER TABLE "new_Mission" RENAME TO "Mission";
CREATE INDEX "Mission_clientId_status_idx" ON "Mission"("clientId", "status");
CREATE INDEX "Mission_billingType_billing_idx" ON "Mission"("billingType", "billing");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
