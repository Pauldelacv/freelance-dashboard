-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "defaultRate" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "color" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "paymentTerms" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rate" INTEGER,
    "startDate" TEXT,
    "endDate" TEXT,
    "estimatedDays" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "fraction" REAL NOT NULL DEFAULT 1,
    "clientId" TEXT,
    "missionId" TEXT,
    "rate" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'billable',
    "note" TEXT,
    "billing" TEXT NOT NULL DEFAULT 'pending',
    "billedAt" TEXT,
    "paidAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkDay_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkDay_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'contacted',
    "estimatedRate" INTEGER,
    "estimatedDays" REAL,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "nextAction" TEXT,
    "nextActionAt" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "receiptUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WatchSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Divers',
    "tags" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "lastVisit" TEXT,
    "faviconUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "revenueTarget" INTEGER,
    "daysTarget" REAL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Mission_clientId_status_idx" ON "Mission"("clientId", "status");

-- CreateIndex
CREATE INDEX "WorkDay_date_idx" ON "WorkDay"("date");

-- CreateIndex
CREATE INDEX "WorkDay_clientId_billing_idx" ON "WorkDay"("clientId", "billing");

-- CreateIndex
CREATE INDEX "WorkDay_billing_idx" ON "WorkDay"("billing");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDay_date_clientId_missionId_key" ON "WorkDay"("date", "clientId", "missionId");

-- CreateIndex
CREATE INDEX "Prospect_stage_position_idx" ON "Prospect"("stage", "position");

-- CreateIndex
CREATE INDEX "Prospect_nextActionAt_idx" ON "Prospect"("nextActionAt");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "WatchSite_category_idx" ON "WatchSite"("category");

-- CreateIndex
CREATE INDEX "WatchSite_favorite_idx" ON "WatchSite"("favorite");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_year_month_key" ON "Goal"("year", "month");
