-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('CLIENT', 'OWN', 'TRAINING', 'EXPERIMENT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'DORMANT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeployStatus" AS ENUM ('UNKNOWN', 'NOT_DEPLOYED', 'STAGING', 'PRODUCTION', 'RETIRED');

-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('MAIN', 'WORKTREE', 'COPY', 'BACKUP');

-- CreateEnum
CREATE TYPE "WebsiteKind" AS ENUM ('CLIENT', 'OWN', 'CENTRAL');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('WEB_SITE', 'WEB_APP', 'ECOMMERCE', 'API', 'ADDON', 'PLUGIN', 'MOBILE_APP', 'DESKTOP_APP', 'BROWSER_EXTENSION', 'LIBRARY', 'AUTOMATION', 'CONTENT');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WORDPRESS', 'WOOCOMMERCE', 'PRESTASHOP', 'SHOPIFY', 'N8N', 'CHROME', 'ELEMENTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('GMAIL', 'GOOGLE_WORKSPACE', 'MICROSOFT', 'IMAP');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'INVOICED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('SN4P', 'YOUTUBE', 'BUNNY', 'GOOGLE', 'GOOGLE_APP', 'META', 'GITHUB', 'GITLAB', 'GITEA', 'MICROSOFT', 'UPTIME_KUMA');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('YOUTUBE', 'BUNNY');

-- CreateEnum
CREATE TYPE "VideoPurpose" AS ENUM ('DEMO', 'SALES', 'MARKETING', 'TUTORIAL');

-- CreateEnum
CREATE TYPE "RepoProvider" AS ENUM ('GITHUB', 'GITLAB', 'GITEA', 'OTHER');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProjectKind" NOT NULL DEFAULT 'OWN',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusLocked" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT,
    "description" TEXT,
    "version" TEXT,
    "localVersion" TEXT,
    "branchVersions" JSONB,
    "framework" TEXT,
    "stack" TEXT[],
    "repoUrl" TEXT,
    "repoLocked" BOOLEAN NOT NULL DEFAULT false,
    "defaultBranch" TEXT,
    "lastCommitAt" TIMESTAMP(3),
    "lastCommitMsg" TEXT,
    "commitCount" INTEGER,
    "uncommitted" INTEGER,
    "untracked" INTEGER,
    "hasClaudeMd" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "deployStatus" "DeployStatus" NOT NULL DEFAULT 'UNKNOWN',
    "hosting" TEXT,
    "deployedVersion" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "type" "ProjectType",
    "platform" "Platform",
    "parentId" TEXT,
    "suggestedType" "ProjectType",
    "suggestedPlatform" "Platform",
    "suggestedDomains" TEXT[],
    "branchStatus" JSONB,
    "localOnlyBranches" TEXT[],
    "remoteOnlyBranches" TEXT[],
    "stashCount" INTEGER,
    "aheadTotal" INTEGER,
    "behindTotal" INTEGER,
    "behindAuthors" TEXT[],
    "rewrittenCommits" INTEGER,
    "lastFetchAt" TIMESTAMP(3),
    "fetchError" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedAt" TIMESTAMP(3),
    "environments" TEXT[],
    "envFiles" JSONB,
    "localCompose" JSONB,
    "composeProject" TEXT,
    "localUrl" TEXT,
    "goneAt" TIMESTAMP(3),
    "clientId" TEXT,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLocation" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" "LocationKind" NOT NULL DEFAULT 'MAIN',
    "branch" TEXT,
    "version" TEXT,
    "modifiedAt" TIMESTAMP(3),
    "uncommitted" INTEGER,
    "untracked" INTEGER,
    "lastCommitAt" TIMESTAMP(3),
    "merged" BOOLEAN,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectService" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "url" TEXT,
    "hosting" TEXT,
    "notes" TEXT,
    "monitor" BOOLEAN NOT NULL DEFAULT true,
    "versionPath" TEXT,
    "liveVersion" TEXT,
    "liveVersionAt" TIMESTAMP(3),
    "websiteId" TEXT,
    "serverId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRoot" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "lastScanAt" TIMESTAMP(3),
    "found" INTEGER,

    CONSTRAINT "ScanRoot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "version" TEXT,
    "notes" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "kind" "WebsiteKind" NOT NULL DEFAULT 'CLIENT',
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "expectStatus" INTEGER NOT NULL DEFAULT 200,
    "lastStatus" TEXT,
    "lastCode" INTEGER,
    "lastMs" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "kumaMonitorId" INTEGER,
    "kumaStatus" TEXT,
    "kumaMs" INTEGER,
    "sslDaysLeft" INTEGER,
    "kumaCheckedAt" TIMESTAMP(3),
    "clientId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UptimeCheck" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "up" BOOLEAN NOT NULL,
    "code" INTEGER,
    "ms" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UptimeCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "projectId" TEXT,
    "websiteId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "provider" "MailProvider" NOT NULL,
    "label" TEXT,
    "connectionId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "externalId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "body" TEXT,
    "toAddress" TEXT,
    "threadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "important" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'iServisat',
    "ownerName" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "logoPath" TEXT,
    "logoData" BYTEA,
    "logoType" TEXT,
    "iban" TEXT,
    "defaultVat" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "quoteFooter" TEXT,
    "pricingGuide" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,

    CONSTRAINT "BrandSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'hora',
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "vat" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "notes" TEXT,
    "scope" TEXT,
    "includes" TEXT[],
    "excludes" TEXT[],
    "assumptions" TEXT[],
    "thirdPartyCosts" TEXT,
    "schedule" JSONB,
    "aiSessionId" TEXT,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "details" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "priceMax" DECIMAL(10,2),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePhase" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "percent" DECIMAL(5,2),
    "dueDate" TIMESTAMP(3),
    "status" "PhaseStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuotePhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteMessage" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[],
    "proposal" JSONB,
    "appliedAt" TIMESTAMP(3),
    "error" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventLink" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "htmlLink" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "account" TEXT,
    "baseUrl" TEXT,
    "secret" TEXT,
    "config" JSONB,
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoChannel" (
    "id" TEXT NOT NULL,
    "provider" "VideoProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "connectionId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoChannelLink" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "match" TEXT,
    "purpose" "VideoPurpose" NOT NULL DEFAULT 'DEMO',

    CONSTRAINT "VideoChannelLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVideo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channelId" TEXT,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "purpose" "VideoPurpose" NOT NULL DEFAULT 'DEMO',
    "publishedAt" TIMESTAMP(3),
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSecret" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvBackup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "content" TEXT NOT NULL,
    "keyCount" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoRemote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" "RepoProvider" NOT NULL DEFAULT 'OTHER',
    "host" TEXT NOT NULL,
    "path" TEXT,
    "visibility" TEXT,
    "defaultBranch" TEXT,
    "lastPushAt" TIMESTAMP(3),
    "openPrs" INTEGER,
    "openIssues" INTEGER,
    "ciStatus" TEXT,
    "ciUrl" TEXT,
    "latestRelease" TEXT,
    "archived" BOOLEAN,
    "syncError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoRemote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "collectUser" TEXT NOT NULL DEFAULT 'infobar',
    "adminUser" TEXT,
    "keyPath" TEXT NOT NULL DEFAULT '~/.ssh/infobar_ed25519',
    "provider" TEXT,
    "panel" TEXT,
    "panelUrl" TEXT,
    "knownIps" TEXT[],
    "allowMail" BOOLEAN NOT NULL DEFAULT false,
    "intervalSec" INTEGER NOT NULL DEFAULT 300,
    "incidentSec" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT,
    "liveStatus" TEXT,
    "error" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "nextAt" TIMESTAMP(3),
    "pausedUntil" TIMESTAMP(3),
    "scriptVersion" TEXT,
    "snapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerSample" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpu" DOUBLE PRECISION,
    "mem" DOUBLE PRECISION,
    "disk" DOUBLE PRECISION,
    "load" DOUBLE PRECISION,
    "servicesOk" INTEGER,
    "servicesTotal" INTEGER,
    "sessions" INTEGER,
    "attempts" INTEGER,
    "exposed" INTEGER[],
    "status" TEXT NOT NULL,

    CONSTRAINT "ServerSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerHour" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "cpuAvg" DOUBLE PRECISION,
    "cpuMax" DOUBLE PRECISION,
    "memMax" DOUBLE PRECISION,
    "diskMax" DOUBLE PRECISION,
    "attempts" INTEGER,
    "worst" TEXT NOT NULL,

    CONSTRAINT "ServerHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerCheck" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ok" BOOLEAN,
    "detail" TEXT,
    "fix" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerContainer" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "desired" INTEGER,
    "running" INTEGER,
    "image" TEXT,
    "version" TEXT,
    "startedAt" TIMESTAMP(3),
    "role" TEXT,
    "detail" TEXT,
    "domains" TEXT[],
    "projectServiceId" TEXT,
    "matchManual" BOOLEAN NOT NULL DEFAULT false,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerAttackIp" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerAttackIp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "containerId" TEXT,
    "containerName" TEXT NOT NULL,
    "projectServiceId" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "image" TEXT,
    "version" TEXT,
    "previousVersion" TEXT,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkerJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerBeat" (
    "id" TEXT NOT NULL DEFAULT 'mac',
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "hostname" TEXT,
    "version" TEXT,
    "roots" TEXT[],

    CONSTRAINT "WorkerBeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_kind_status_idx" ON "Project"("kind", "status");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLocation_path_key" ON "ProjectLocation"("path");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectService_websiteId_key" ON "ProjectService"("websiteId");

-- CreateIndex
CREATE INDEX "ProjectService_projectId_idx" ON "ProjectService"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanRoot_path_key" ON "ScanRoot"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_projectId_websiteId_key" ON "Installation"("projectId", "websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Website_url_key" ON "Website"("url");

-- CreateIndex
CREATE INDEX "UptimeCheck_websiteId_checkedAt_idx" ON "UptimeCheck"("websiteId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_address_key" ON "MailAccount"("address");

-- CreateIndex
CREATE UNIQUE INDEX "SavedMessage_accountId_externalId_key" ON "SavedMessage"("accountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateIndex
CREATE INDEX "QuoteMessage_quoteId_createdAt_idx" ON "QuoteMessage"("quoteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventLink_calendarId_eventId_key" ON "CalendarEventLink"("calendarId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoChannel_provider_externalId_key" ON "VideoChannel"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoChannelLink_channelId_projectId_key" ON "VideoChannelLink"("channelId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVideo_projectId_url_key" ON "ProjectVideo"("projectId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSecret_projectId_environment_key_key" ON "ProjectSecret"("projectId", "environment", "key");

-- CreateIndex
CREATE INDEX "EnvBackup_projectId_environment_createdAt_idx" ON "EnvBackup"("projectId", "environment", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepoRemote_projectId_name_key" ON "RepoRemote"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Server_name_key" ON "Server"("name");

-- CreateIndex
CREATE INDEX "ServerSample_serverId_at_idx" ON "ServerSample"("serverId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "ServerHour_serverId_hour_key" ON "ServerHour"("serverId", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "ServerCheck_serverId_key_key" ON "ServerCheck"("serverId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ServerContainer_serverId_name_key" ON "ServerContainer"("serverId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServerAttackIp_serverId_ip_key" ON "ServerAttackIp"("serverId", "ip");

-- CreateIndex
CREATE INDEX "Deployment_projectServiceId_at_idx" ON "Deployment"("projectServiceId", "at");

-- CreateIndex
CREATE INDEX "Deployment_serverId_at_idx" ON "Deployment"("serverId", "at");

-- CreateIndex
CREATE INDEX "WorkerJob_status_createdAt_idx" ON "WorkerJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLocation" ADD CONSTRAINT "ProjectLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UptimeCheck" ADD CONSTRAINT "UptimeCheck_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMessage" ADD CONSTRAINT "SavedMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMessage" ADD CONSTRAINT "SavedMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMessage" ADD CONSTRAINT "SavedMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePhase" ADD CONSTRAINT "QuotePhase_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteMessage" ADD CONSTRAINT "QuoteMessage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventLink" ADD CONSTRAINT "CalendarEventLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventLink" ADD CONSTRAINT "CalendarEventLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventLink" ADD CONSTRAINT "CalendarEventLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoChannel" ADD CONSTRAINT "VideoChannel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoChannelLink" ADD CONSTRAINT "VideoChannelLink_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "VideoChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoChannelLink" ADD CONSTRAINT "VideoChannelLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVideo" ADD CONSTRAINT "ProjectVideo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVideo" ADD CONSTRAINT "ProjectVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "VideoChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSecret" ADD CONSTRAINT "ProjectSecret_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvBackup" ADD CONSTRAINT "EnvBackup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoRemote" ADD CONSTRAINT "RepoRemote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSample" ADD CONSTRAINT "ServerSample_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerHour" ADD CONSTRAINT "ServerHour_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerCheck" ADD CONSTRAINT "ServerCheck_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerContainer" ADD CONSTRAINT "ServerContainer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerContainer" ADD CONSTRAINT "ServerContainer_projectServiceId_fkey" FOREIGN KEY ("projectServiceId") REFERENCES "ProjectService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAttackIp" ADD CONSTRAINT "ServerAttackIp_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ServerContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectServiceId_fkey" FOREIGN KEY ("projectServiceId") REFERENCES "ProjectService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
