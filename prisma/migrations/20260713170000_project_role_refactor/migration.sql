-- AlterEnum
ALTER TYPE "Role" RENAME VALUE 'DEVELOPER' TO 'STAFF';

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectRole" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move existing data from ProjectTeam to ProjectMember
INSERT INTO "ProjectMember" ("id", "projectId", "userId", "projectRole", "joinedAt", "updatedAt")
SELECT 
  gen_random_uuid(), 
  "projectId", 
  "userId", 
  CASE 
    WHEN "role" = 'Project Manager' THEN 'Project Manager'
    WHEN "role" = 'Lead Developer' THEN 'Lead Developer'
    WHEN "role" = 'Developer' THEN 'Developer'
    WHEN "role" = 'Designer' THEN 'Designer'
    WHEN "role" = 'QA' THEN 'QA'
    ELSE 'Developer'
  END, 
  "joinedDate", 
  NOW()
FROM "ProjectTeam";

-- DropTable
DROP TABLE "ProjectTeam";
