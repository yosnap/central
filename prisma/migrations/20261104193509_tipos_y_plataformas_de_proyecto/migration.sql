-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Platform" ADD VALUE 'GITHUB';
ALTER TYPE "Platform" ADD VALUE 'CLAUDE_CODE';
ALTER TYPE "Platform" ADD VALUE 'CODEX';
ALTER TYPE "Platform" ADD VALUE 'NPM';
ALTER TYPE "Platform" ADD VALUE 'PYPI';
ALTER TYPE "Platform" ADD VALUE 'VSCODE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectType" ADD VALUE 'MCP';
ALTER TYPE "ProjectType" ADD VALUE 'CLI';
ALTER TYPE "ProjectType" ADD VALUE 'AGENT';
ALTER TYPE "ProjectType" ADD VALUE 'AGENT_PLUGIN';
ALTER TYPE "ProjectType" ADD VALUE 'TEMPLATE';
ALTER TYPE "ProjectType" ADD VALUE 'DOCS';
